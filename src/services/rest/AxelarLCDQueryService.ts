import appConfig from "../../config";
import { AxiosService } from "./axios/AxiosService";
import { RegisterProxyGetResponse } from "./interfaces/tx/RegisterProxyGetResponse";

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
  ): Promise<string> {
    const response = await this.getValidatorRegisterProxyInfo(operatorAddress);
    if (response?.txs.length === 0) {
      return Promise.reject("No RegisterProxy tx found");
    }

    const firstMessage = response?.txs?.[0]?.body?.messages?.[0];

    if (!firstMessage) {
      return Promise.reject("No message found in RegisterProxy tx");
    }

    return firstMessage.proxy_addr;
  }
}
