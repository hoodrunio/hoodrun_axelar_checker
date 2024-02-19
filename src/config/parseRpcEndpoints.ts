export interface RpcEnvEndpoint {
  name: string;
  endpoint: string;
}
export const parseRpcEndpoints = (): RpcEnvEndpoint[] => {
  const res: RpcEnvEndpoint[] = [];

  Object.keys(process.env).forEach((envVariable) => {
    // Check if the environment variable matches the pattern
    if (envVariable.endsWith("_RPC_ENDPOINT")) {
      // Extract the name from the environment variable
      const name = envVariable.replace("_RPC_ENDPOINT", "");
      // Get the RPC endpoint value from the environment variable
      const rpcEndpoint = process.env[envVariable];
      // Use name and rpcEndpoint as needed
      if (rpcEndpoint) {
        const curr = { name, endpoint: rpcEndpoint };
        res.push(curr);
      }
    }
  });

  return res;
};
