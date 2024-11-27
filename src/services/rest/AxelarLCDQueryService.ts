import appConfig from "@/config/index";
import { AxiosService } from "@/services/rest/axios/AxiosService";
import { RegisterProxyGetResponse } from "@/services/rest/interfaces/tx/RegisterProxyGetResponse";
import { logger } from "@/utils/logger";

// Cache voter addresses since they rarely change
const voterAddressCache: { [key: string]: { address: string | null, timestamp: number } } = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export class AxelarLCDQueryService {
  restClient: AxiosService;
  archiveClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarLCDRestBaseUrls,
    });
    
    this.archiveClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarArchiveRestBaseUrls,
    });
  }

  /*Proxy Address means broadcaster and voter address also*/
  private async getValidatorRegisterProxyInfo(
    operatorAddress: string
  ): Promise<RegisterProxyGetResponse | null> {
    try {
      const response = await this.archiveClient.request<RegisterProxyGetResponse>({
        method: "GET",
        url: `/cosmos/tx/v1beta1/txs?events=message.sender='${operatorAddress}'&events=message.action='RegisterProxy'`,
      });

      return response?.data || null;
    } catch (error: any) {
      // Log the error but return null to allow graceful handling
      logger.error(`Failed to get validator register proxy info for ${operatorAddress}: ${error.message}`);
      return null;
    }
  }

  public async getValidatorVoterAddress(
    operatorAddress: string
  ): Promise<string | null> {
    try {
      // Check cache first
      const cached = voterAddressCache[operatorAddress];
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        logger.debug(`Using cached voter address for ${operatorAddress}`);
        return cached.address;
      }

      const response = await this.getValidatorRegisterProxyInfo(operatorAddress);
      
      // If no response or no transactions, cache null result
      if (!response?.txs || response.txs.length === 0) {
        logger.info(`No RegisterProxy tx found for ${operatorAddress}`);
        voterAddressCache[operatorAddress] = { address: null, timestamp: Date.now() };
        return null;
      }
      
      const firstMessage = response.txs[0]?.body?.messages?.[0];
      if (!firstMessage) {
        logger.info(`No messages found in RegisterProxy tx for ${operatorAddress}`);
        voterAddressCache[operatorAddress] = { address: null, timestamp: Date.now() };
        return null;
      }

      const voterAddress = firstMessage.proxy_addr as string;
      if (!voterAddress) {
        logger.info(`No proxy_addr found in RegisterProxy tx for ${operatorAddress}`);
        voterAddressCache[operatorAddress] = { address: null, timestamp: Date.now() };
        return null;
      }

      // Cache the successful result
      voterAddressCache[operatorAddress] = { address: voterAddress, timestamp: Date.now() };
      return voterAddress;
    } catch (error) {
      logger.error(`Error getting validator voter address for ${operatorAddress}: ${error}`);
      // Don't cache errors, but return null to allow the process to continue
      return null;
    }
  }
}
