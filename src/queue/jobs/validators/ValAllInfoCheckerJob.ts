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
import { xSeconds } from "queue/jobHelper";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";

export const VAL_ALL_INFO_CHECKER = "valAllInfoChecker";

export const initValAllInfoCheckerQueue = async () => {
  const valAllInfoCheckerQueue =
    AppQueueFactory.createQueue(VAL_ALL_INFO_CHECKER);

  valAllInfoCheckerQueue.process(4, async (_) => {
    logger.info("Processing valAllInfoCheckerQueue");
    try {
      const validatorRepo = new ValidatorRepository();
      const axelarQService = new AxelarQueryService();
      const axelarLCDService = new AxelarLCDQueryService();
      const { validatorRepository } = new AppDb();

      const [validatorsRes, allEvmChainsWithMaintainersRes] = await Promise.all(
        [
          axelarQService.getAllValidators(),
          axelarQService.getAxelarAllEvmChainsWithMaintainers(),
        ]
      );

      const validators = validatorsRes.validators;
      const newChainsMaintainers = allEvmChainsWithMaintainersRes;

      const promises = validators.map(async (validator) => {
        const is_active = validator.status == "BOND_STATUS_BONDED";
        const valEvmSupportedChains: string[] = [];
        const operatorAddress = validator.operator_address;

        for (const [
          newChain,
          newMaintainers,
        ] of newChainsMaintainers.entries()) {
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
          voterAddress = await axelarLCDService.getValidatorVoterAddress(
            operatorAddress
          );
        } catch (error) {
          logger.error(`Failed to get voter address: ${error}`);
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
    .filter((chainName) => {
      return !newSupportedChains.includes(chainName);
    })
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
