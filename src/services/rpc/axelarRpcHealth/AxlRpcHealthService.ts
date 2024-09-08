import { RpcEnvEndpoint } from "@/config/parseRpcEndpoints";
import { AxiosService } from "@/services/rest/axios/AxiosService";
import { BaseRpcResult } from "@/services/rpc/axelarRpcHealth/interfaces/BaseRpcResult";
import { AvalancheExtInfoResponse } from "@/services/rpc/axelarRpcHealth/interfaces/avalanche/AvalancheExtInfoResponse";

type RpcBodyParams = { [x: string]: any } | any[];
// Define a type for the RPC call body
type AxlRpcHealthCallBody = {
  id: number;
  jsonrpc: string;
  method: string;
  params: RpcBodyParams; // Can be any type of object or array
};

// Define a class for RpcHealthHelper
export class AxlRpcHealthService {
  rpcClient: AxiosService;
  name: string;
  rpc_addr: string;

  constructor(params: RpcEnvEndpoint) {
    const { name, endpoint: rpc_addr } = params;

    this.name = name.toUpperCase();
    this.rpc_addr = rpc_addr;
    const urls = [rpc_addr];
    this.rpcClient = new AxiosService({ baseUrls: urls });
  }

  // Generate method and params based on the name
  private generateRpcCallBodyParams(): AxlRpcHealthCallBody {
    let method: string;
    let params: RpcBodyParams | [] = [];

    switch (this.name.toUpperCase()) {
      case "AVALANCHE":
        method = "info.isBootstrapped";
        params = { chain: "C" };
        break;
      case "FILECOIN":
        method = "Filecoin.ChainHead";
        break;
      default:
        method = "eth_syncing";
        break;
    }

    return {
      id: 1,
      jsonrpc: "2.0",
      method,
      params,
    };
  }

  private async makeRpcHealthRequest(): Promise<BaseRpcResult<boolean>> {
    const body = this.generateRpcCallBodyParams();
    try {
      const response = await this.rpcClient.request<BaseRpcResult<boolean>>({
        method: "POST",
        url: this.rpc_addr,
        body,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Error making RPC request to ${this.name}: ${error}`);
    }
  }

  private async checkFilecoinRpcHealth(response: any): Promise<boolean> {
    let res = false;
    try {
      const latestBlock = await this.rpcClient.request({
        method: "POST",
        url: `${this.rpc_addr}`,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        },
      });
      const res = "a";
    } catch (error) {
      throw new Error(`Error checking health of ${this.name}: ${error}`);
    }

    return res;
  }

  private async checkDefaultRpcHealth(): Promise<boolean> {
    let res = false;
    const rpcResponse = await this.makeRpcHealthRequest();

    //So does not need to be syncing that means result is false which means it is healthy
    if (!rpcResponse.result) {
      res = true;
    }

    return res;
  }

  private async checkAvalancheCChainRpcHealth(): Promise<boolean> {
    let res = false;
    const url = new URL(this.rpc_addr);
    const origin = url.origin;
    const body = this.generateRpcCallBodyParams();

    try {
      const response = await this.rpcClient.request<
        BaseRpcResult<AvalancheExtInfoResponse>
      >({
        method: "POST",
        url: `${origin}/ext/info`,
        body,
        headers: {
          "Content-Type": "application/json",
        },
      });

      res = response?.data?.result?.isBootstrapped ?? false;
    } catch (error) {
      throw new Error(`Error checking health of ${this.name}: ${error}`);
    }

    return res;
  }

  async isHealthy(): Promise<boolean> {
    let res = false;
    try {
      switch (this.name.toUpperCase()) {
        case "AVALANCHE":
          res = await this.checkAvalancheCChainRpcHealth();
          break;
        case "FILECOIN":
          //TODO: Implement Filecoin health check
          // res = await this.checkFilecoinRpcHealth();
          break;
        case "BASE":
          //TODO: Implement BASE health check
          // res = await this.checkBaseRpcHealth();
          break;
        default:
          res = await this.checkDefaultRpcHealth();
          break;
      }

      return res;
    } catch (error) {
      throw new Error(`Error checking health of ${this.name}: ${error}`);
    }

    return res;
  }
}
