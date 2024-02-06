import appConfig from "../../config";
import { AxiosService } from "./axios/AxiosService";
import { ValidatorsGetResponse } from "./interfaces/validators/ValidatorsGetResponse";
import { AxelarPaginationRequest } from "./pagination/AxelarPaginationRequest";

export class AxelarQueryService {
  restClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrl: appConfig.mainnetAxelarRestBaseUrl,
    });
  }

  public async getAllValidators(): Promise<ValidatorsGetResponse> {
    const pagination = new AxelarPaginationRequest({ limit: 1000 });
    const response = await this.restClient.request<ValidatorsGetResponse>({
      method: "GET",
      url: "/cosmos/staking/v1beta1/validators",
      params: { ...pagination.asRequestParams() },
    });

    return response?.data;
  }
}
