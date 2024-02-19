import { IValidator } from "@/database/models/validator/validator.interface";
import { RpcEndpointHealthResult } from "@/queue/jobs/rpc_endpoint_healthy/RpcEndpointHealthcheckerJob";

export const createRpcEndpointHealthCondition = (
  validator: IValidator,
  latestRpcEndpointStatus: RpcEndpointHealthResult
): string => {
  const { operator_address } = validator;
  const { isHealthy, name } = latestRpcEndpointStatus;

  const from = isHealthy ? "unhealthy" : "healthy";
  const changedTo = isHealthy ? "healthy" : "unhealthy";

  return `${operator_address}-${name}-rpc-endpoint-health-${from}-to-${changedTo}`;
};
