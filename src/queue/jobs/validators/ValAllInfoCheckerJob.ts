import appConfig from "@/config/index";
import { AppDb } from "@/database/database";
import {
  ChainRegistrationStatus,
  EvmSupprtedChainRegistrationNotificationDataType,
  INotification,
  NotificationEvent,
  NotificationType,
} from "@/database/models/notification/notification.interface";
import {
  IValidator,
  IValidatorDocument,
} from "@/database/models/validator/validator.interface";
import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";
import { AxelarLCDQueryService } from "@services/rest/AxelarLCDQueryService";
import { AxelarQueryService } from "@services/rest/AxelarQueryService";
import {
  ADDRESS_TYPE_PREFIX,
  convertPubKeyToBech32,
} from "@utils/cosmos/cosmosConverter";
import { logger } from "@utils/logger";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Queue, Job } from 'bull';

export const VAL_ALL_INFO_CHECKER = "valAllInfoChecker";

class ValAllInfoCheckerQueueManager {
  private static instance: ValAllInfoCheckerQueueManager;
  private queue: Queue | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ValAllInfoCheckerQueueManager {
    if (!ValAllInfoCheckerQueueManager.instance) {
      ValAllInfoCheckerQueueManager.instance = new ValAllInfoCheckerQueueManager();
    }
    return ValAllInfoCheckerQueueManager.instance;
  }

  public async getQueue(): Promise<Queue> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.queue) {
      await this.initQueue();
    }
    return this.queue!;
  }

  private async initQueue(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (this.isInitialized && this.queue) {
          try {
            await this.queue.getJobCounts();
            return;
          } catch (error) {
            logger.error('Queue check failed, reinitializing...', error);
            this.isInitialized = false;
            this.queue = null;
          }
        }

        this.queue = AppQueueFactory.createQueue(VAL_ALL_INFO_CHECKER);

        this.queue.process(4, async (_) => {
          logger.info("Processing valAllInfoCheckerQueue");
          try {
            const validatorRepo = new ValidatorRepository();
            const axelarQService = new AxelarQueryService();
            const axelarLCDService = new AxelarLCDQueryService();
            const { validatorRepository } = new AppDb();

            const [validatorsRes, allEvmChainsWithMaintainersRes] = await Promise.all([
              axelarQService.getAllValidators(),
              axelarQService.getAxelarAllEvmChainsWithMaintainers(),
            ]);

            const validators = validatorsRes.validators;
            const newChainsMaintainers = allEvmChainsWithMaintainersRes;

            const promises = validators.map(async (validator) => {
              const is_active = validator.status == "BOND_STATUS_BONDED";
              const valEvmSupportedChains: string[] = [];
              const operatorAddress = validator.operator_address;

              for (const [newChain, newMaintainers] of newChainsMaintainers.entries()) {
                if (newMaintainers.includes(operatorAddress)) {
                  valEvmSupportedChains.push(newChain);
                }
              }

              let dbValidator: IValidatorDocument | null = null;
              try {
                dbValidator = await validatorRepository.findOne({
                  operator_address: operatorAddress,
                });
              } catch (error) {
                logger.error(`Failed to get validator from db: ${error}`);
              }

              let voterAddress = dbValidator?.voter_address ?? null;

              try {
                // First try to get voter address from LCD service
                voterAddress = await axelarLCDService.getValidatorVoterAddress(
                  operatorAddress
                );
                
                // If LCD service fails and we have a configured operator address that matches
                if (!voterAddress && appConfig.axelarOperatorAddress === operatorAddress) {
                  voterAddress = appConfig.axelarVoterAddress;
                  logger.info(
                    `Using configured voter address for operator ${operatorAddress}`
                  );
                }
              } catch (error) {
                logger.error(`Failed to get voter address: ${error}`);
                
                // Fallback to configured mapping if LCD fails
                if (appConfig.axelarOperatorAddress === operatorAddress) {
                  voterAddress = appConfig.axelarVoterAddress;
                  logger.info(
                    `Using configured voter address after LCD failure for operator ${operatorAddress}`
                  );
                }
              }

              // Update verifier addresses if this is our validator
              let verifierAddresses: string[] = [];

              if (voterAddress === appConfig.axelarVoterAddress) {
                // Direct assignment of monitored verifiers - no extra parsing needed
                verifierAddresses = appConfig.monitoredVerifiers;
                
                logger.info(
                  `Updated verifier addresses for validator ${operatorAddress}: ${verifierAddresses.join(', ')}`
                );
              }

              try {
                if (voterAddress && appConfig.axelarVoterAddress == voterAddress && dbValidator) {
                  await sendEvmChainSupportRegistrationNotification(
                    dbValidator,
                    valEvmSupportedChains
                  );
                } else {
                  if(!voterAddress) {
                    logger.info(
                      `Voter address not found for operator address: ${operatorAddress}`
                    );
                  }
                }
              } catch (error) {
                logger.error(
                  `Failed to send evm chain support registration notification: ${error}`
                );
              }

              const consensusAddress = convertPubKeyToBech32(
                validator.consensus_pubkey,
                ADDRESS_TYPE_PREFIX.VALCONSENSUS
              );

              let uptime = dbValidator?.uptime ?? 0;
              if (is_active) {
                try {
                  uptime = await axelarQService.getSafeValidatorUptime(
                    consensusAddress
                  );
                } catch (error) {
                  logger.error(`Failed to get validator uptime: ${error}`);
                }
              }

              try {
                await validatorRepo.upsertOne(
                  { operator_address: operatorAddress },
                  {
                    operator_address: operatorAddress,
                    consensus_address: consensusAddress,
                    consensus_pubkey: validator.consensus_pubkey,
                    jailed: validator.jailed,
                    status: validator.status,
                    tokens: validator.tokens,
                    delegator_shares: validator.delegator_shares,
                    description: validator.description,
                    unbonding_height: validator.unbonding_height,
                    unbonding_time: validator.unbonding_time,
                    commission: validator.commission,
                    min_self_delegation: validator.min_self_delegation,
                    supported_evm_chains: valEvmSupportedChains,
                    ...(voterAddress ? { voter_address: voterAddress } : {}),
                    verifier_addresses: verifierAddresses,
                    uptime,
                    is_active,
                  }
                );
              } catch (error) {
                logger.error(`Failed to create validator: ${error}`);
              }
            });

            try {
              await Promise.all(promises);
            } catch (error) {
              logger.error(`Failed to concurrent update validators: ${error}`);
            }

            return Promise.resolve();
          } catch (error) {
            logger.error(`Error in valAllInfoCheckerHandler: ${error}`);
            return Promise.reject(error);
          }
        });

        // Add error handler
        this.queue.on('error', (error: Error) => {
          logger.error('Queue error:', error);
        });

        // Add stalled handler
        this.queue.on('stalled', (job: Job) => {
          logger.warn('Job stalled:', job.id);
        });

        this.isInitialized = true;
        logger.info('ValAllInfoChecker queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing ValAllInfoChecker queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = ValAllInfoCheckerQueueManager.getInstance();

export const initValAllInfoCheckerQueue = async () => {
  await queueManager.getQueue();
};

export const addValAllInfoCheckerJob = () => {
  appJobProducer.addJob(
    VAL_ALL_INFO_CHECKER,
    {},
    { repeat: { every: xSeconds(10) } }
  );
};

type NotificationData = EvmSupprtedChainRegistrationNotificationDataType;

const sendEvmChainSupportRegistrationNotification = async (
  validator: IValidator,
  valEvmSupportedChains: string[]
) => {
  const { notificationRepo, telegramUserRepo } = new AppDb();
  const allTgUsers = await telegramUserRepo.findAll();
  if (!allTgUsers || allTgUsers.length < 1) return;

  const oldSupportedChains = validator.supported_evm_chains;
  const newSupportedChains = valEvmSupportedChains;
  const validatorOperatorAddress = validator.operator_address;
  const validatorMoniker = validator.description.moniker;

  const newlyRegisteredChains: NotificationData[] = newSupportedChains
    .filter((chainName) => !oldSupportedChains.includes(chainName))
    ?.map((chainName) => ({
      chain: chainName,
      operatorAddress: validatorOperatorAddress,
      moniker: validatorMoniker,
      status: ChainRegistrationStatus.REGISTERED,
    }));

  const newlyDeregisteredChains: NotificationData[] = oldSupportedChains
    .filter((chainName) => !newSupportedChains.includes(chainName))
    ?.map((chainName) => ({
      chain: chainName,
      operatorAddress: validatorOperatorAddress,
      moniker: validatorMoniker,
      status: ChainRegistrationStatus.DEREGISTERED,
    }));

  const allNotificationData: NotificationData[] = [
    ...newlyRegisteredChains,
    ...newlyDeregisteredChains,
  ];

  const notificationPromises = allNotificationData.map(async (data) => {
    for (const tgUser of allTgUsers) {
      const currentTimestamp = new Date().getTime();
      const notificationId = `evm_chain_change_${validatorOperatorAddress}-${data.chain}-${currentTimestamp}`;
      const condition = `evm_supported_chain_registration-${validatorOperatorAddress}-${data.chain}`;

      const notification: INotification = {
        data,
        condition,
        notification_id: notificationId,
        event: NotificationEvent.EVM_SUPPORTED_CHAIN_REGISTRATION,
        type: NotificationType.TELEGRAM,
        recipient: tgUser.chat_id.toString(),
        sent: false,
      };

      const isNotificationExist = await notificationRepo.findOne({
        data: {
          chain: data.chain,
          operatorAddress: data.operatorAddress,
          moniker: data.moniker,
          status: data.status,
        },
        event: NotificationEvent.EVM_SUPPORTED_CHAIN_REGISTRATION,
        type: NotificationType.TELEGRAM,
        sent: false,
      });
      if (isNotificationExist) return;

      await notificationRepo.create(notification);
    }
  });

  try {
    await Promise.all(notificationPromises);
  } catch (error) {
    logger.error(
      `Failed to create evm chain support registration notification: ${error}`
    );
  }
};
