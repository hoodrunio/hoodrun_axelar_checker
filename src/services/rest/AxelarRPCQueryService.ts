import { logger } from "@utils/logger";
import appConfig from "../../config";
import { AxiosService } from "./axios/AxiosService";
import { AxlBlockChainGetResponse } from "./interfaces/blockchain/BlockChainGetResponse";

export class AxelarRPCQueryService {
  restClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarRpcBaseUrls,
    });
  }

  async getBlockChain(): Promise<AxlBlockChainGetResponse> {
    try {
      const response = await this.restClient.request<AxlBlockChainGetResponse>({
        method: "GET",
        url: "blockchain",
      });

      return response?.data;
    } catch (error) {
      logger.error(`Could not fetch block chain`);
      throw new Error(`Could not fetch block chain`);
    }
  }

  async getLatestBlockHeight(): Promise<number> {
    const response = await this.getBlockChain();
    return parseInt(response.result.last_height);
  }
}
