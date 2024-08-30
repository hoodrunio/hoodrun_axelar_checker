import appConfig from "@/config/index";
import { AxiosService } from "@/services/rest/axios/AxiosService";
import { RegisterProxyGetResponse } from "@/services/rest/interfaces/tx/RegisterProxyGetResponse";
import { logger } from "@/utils/logger";

export class AxelarLCDQueryService {
  restClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarLCDRestBaseUrls,
    });
  }

  /*Proxy Address means broadcaster and voter address also*/
  private async getValidatorRegisterProxyInfo(
    operatorAddress: string
  ): Promise<RegisterProxyGetResponse> {
    const response = await this.restClient.request<RegisterProxyGetResponse>({
      method: "GET",
      url: `cosmos/tx/v1beta1/txs?events=message.sender='${operatorAddress}'&events=message.action='RegisterProxy'`,
    });

    return response?.data;
  }

  public async getValidatorVoterAddress(
    operatorAddress: string
  ): Promise<string | null> {
    const response = await this.getValidatorRegisterProxyInfo(operatorAddress);
    if (response?.txs.length === 0) {
      logger.warn(`No RegisterProxy tx found for ${operatorAddress}`);
      return null;
    }

    const firstMessage = response?.txs?.[0]?.body?.messages?.[0];

    if (!firstMessage) {
      logger.warn(`No messages found for ${operatorAddress}`);
      return null;
    }

    return firstMessage.proxy_addr as string;
  }
}
