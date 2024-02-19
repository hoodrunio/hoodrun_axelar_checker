import appConfig from "@/config/index";
import { AppDb } from "@/database/database";
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
        const { isHealthy, name, endpoint } = rpcEndpointHealthResult;

        if (envValidator) {
          const rpcHealthEndpoint = {
            name,
            isHealthy,
            rpcEndpoint: endpoint,
          };

          try {
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

interface RpcEndpointHealthResult {
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
