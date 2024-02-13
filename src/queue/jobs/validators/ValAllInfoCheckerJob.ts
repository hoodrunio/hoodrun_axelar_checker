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

  valAllInfoCheckerQueue.process(1, async (_) => {
    logger.info("Processing valAllInfoCheckerQueue");
    try {
      const validatorRepo = new ValidatorRepository();
      const axelarQService = new AxelarQueryService();
      const axelarLCDService = new AxelarLCDQueryService();

      const [validatorsRes, allEvmChainsWithMaintainersRes] = await Promise.all(
        [
          axelarQService.getAllValidators(),
          axelarQService.getAxelarAllEvmChainsWithMaintainers(),
        ]
      );

      const validators = validatorsRes.validators;
      const chainsMaintainers = allEvmChainsWithMaintainersRes;

      const promises = validators.map(async (validator) => {
        const valEvmSupportedChains: string[] = [];
        const operatorAddress = validator.operator_address;

        for (const [chain, maintainers] of chainsMaintainers.entries()) {
          if (maintainers.includes(operatorAddress)) {
            valEvmSupportedChains.push(chain);
          }
        }

        const consensusAddress = convertPubKeyToBech32(
          validator.consensus_pubkey,
          ADDRESS_TYPE_PREFIX.VALCONSENSUS
        );

        let voterAddress = null;

        try {
          voterAddress = await axelarLCDService.getValidatorVoterAddress(
            operatorAddress
          );
        } catch (error) {
          logger.error(`Failed to get voter address: ${error}`);
        }

        const uptime = await axelarQService.getSafeValidatorUptime(
          consensusAddress
        );
        const is_active = validator.status == "BOND_STATUS_BONDED";

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
    { repeat: { every: xSeconds(20) } }
  );
};
