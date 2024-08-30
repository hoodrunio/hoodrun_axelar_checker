import appConfig from "@/config/index";
import { AxiosService } from "@/services/rest/axios/AxiosService";
import { logger } from "@utils/logger";

interface BalanceResponse {
  balances: { denom: string; amount: string }[];
  pagination: { next_key: null; total: string };
}

export class AxelarBalanceQueryService {
  restClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarLCDRestBaseUrls,
    });
  }

  async getBroadcasterBalance(): Promise<number> {
    try {
      const response = await this.restClient.request<BalanceResponse>({
        method: "GET",
        url: `/cosmos/bank/v1beta1/balances/${appConfig.axelarVoterAddress}`,
      });

      const uaxlBalance = response.data.balances.find(
        (balance) => balance.denom === "uaxl"
      );

      if (!uaxlBalance) {
        throw new Error("uaxl balance not found");
      }

      return parseInt(uaxlBalance.amount);
    } catch (error) {
      logger.error(`Error fetching broadcaster balance: ${error}`);
      throw error;
    }
  }
}