import appConfig from "@/config/index";
import { AppDb } from "@/database/database";
import {
  NotificationEvent,
  NotificationType,
  RpcEndpointHealthNotificationDataType,
} from "@/database/models/notification/notification.interface";
import { IValidator } from "@/database/models/validator/validator.interface";
import { createRpcEndpointHealthCondition } from "@/notification/condition/rpcEndpointHealth";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { AxlRpcHealthService } from "@/services/rpc/axelarRpcHealth/AxlRpcHealthService";
import { logger } from "@/utils/logger";

const RPC_ENDPOINT_HEALTHCHECKER_JOB = "RpcEndpointHealthcheckerJob";

export const initRpcEndpointHealthcheckerQueue = async () => {
  const rpcEndpointHealthcheckerJobQueue = AppQueueFactory.createQueue(
    RPC_ENDPOINT_HEALTHCHECKER_JOB
  );

  rpcEndpointHealthcheckerJobQueue.process(async () => {
    const { validatorRepository } = new AppDb();

    try {
      const envValidator = await validatorRepository.findOne({
        voter_address: appConfig.axelarVoterAddress,
      });
      const rpcEndpointsHealthBatchResult = await getRpcEndpointsHealth();
      //This can not be concurrent because of the db write is not concurrent for same document
      rpcEndpointsHealthBatchResult.forEach(async (rpcEndpointHealthResult) => {
        const {
          isHealthy: newIsHealthy,
          name,
          endpoint,
        } = rpcEndpointHealthResult;

        if (envValidator) {
          try {
            const currentRpcEndpointHealth =
              await validatorRepository.getRpcHealthEndpointWithName(
                {
                  operator_address: envValidator.operator_address,
                },
                name
              );

            if (currentRpcEndpointHealth?.isHealthy != newIsHealthy) {
              await addRpcEndpointHealthForNotification(
                rpcEndpointHealthResult,
                envValidator
              );
            }

            const rpcHealthEndpoint = {
              name,
              isHealthy: newIsHealthy,
              rpcEndpoint: endpoint,
            };
            await validatorRepository.upsertRpcHealthEndpoint(
              { voter_address: appConfig.axelarVoterAddress },
              rpcHealthEndpoint
            );
          } catch (error) {
            console.error(
              `Error upserting rpc health endpoint for ${name}`,
              error
            );
          }
        }
      });
    } catch (error) {
      console.error("Error in RpcEndpointHealthcheckerJob", error);
    }
  });
};

export const addRpcEndpointHealthcheckerJob = () => {
  appJobProducer.addJob(
    RPC_ENDPOINT_HEALTHCHECKER_JOB,
    {},
    { repeat: { every: xSeconds(25) } }
  );
};

export interface RpcEndpointHealthResult {
  isHealthy: boolean;
  name: string;
  endpoint: string;
}
const getRpcEndpointsHealth = async (): Promise<RpcEndpointHealthResult[]> => {
  const rpcEndpoints = appConfig.parsedRpcEndpoints;
  const requests = rpcEndpoints.map(async (rpcEndpoint) => {
    const axlrRpcHealthService = new AxlRpcHealthService(rpcEndpoint);
    const res = await axlrRpcHealthService.isHealthy();
    return Promise.resolve({
      isHealthy: res,
      name: axlrRpcHealthService.name,
      endpoint: rpcEndpoint.endpoint,
    });
  });

  const results = await Promise.allSettled(requests);
  const rpcEndpointHealthResults: RpcEndpointHealthResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      rpcEndpointHealthResults.push(result.value);
    } else {
      logger.error("Error checking rpc health", result.reason);
    }
  }

  return rpcEndpointHealthResults;
};

const addRpcEndpointHealthForNotification = async (
  rpcEndpointResult: RpcEndpointHealthResult,
  validator: IValidator
) => {
  const { name, endpoint, isHealthy } = rpcEndpointResult;
  const { notificationRepo, telegramUserRepo } = new AppDb();
  const tgUsers = await telegramUserRepo.findAll({});
  if (!tgUsers || tgUsers.length < 1) return;
  //give current timesstamp as notification id
  const currentTimestamp = new Date().getTime();
  const notificationId = `rpc_health_change-${rpcEndpointResult.name}-${validator.operator_address}${currentTimestamp}`;
  const condition = createRpcEndpointHealthCondition(
    validator,
    rpcEndpointResult
  );
  const notificationType = NotificationType.TELEGRAM;
  const notificationEvent = NotificationEvent.RPC_ENDPOINT_HEALTH;
  const data: RpcEndpointHealthNotificationDataType = {
    name,
    isHealthy,
    rpcEndpoint: endpoint,
    moniker: validator.description.moniker,
    operatorAddress: validator.operator_address,
  };

  const promisses = tgUsers.map(async (user) => {
    await notificationRepo.upsertOne(
      { notification_id: notificationId },
      {
        data,
        condition,
        notification_id: notificationId,
        event: notificationEvent,
        type: notificationType,
        recipient: user.chat_id.toString(),
        sent: false,
      }
    );
  });

  await Promise.all(promisses);
};
