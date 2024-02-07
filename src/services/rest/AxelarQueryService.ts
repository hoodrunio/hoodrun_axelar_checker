import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";
import {
  ADDRESS_TYPE_PREFIX,
  convertPubKeyToBech32,
} from "@utils/cosmos/cosmosConverter";
import BigNumber from "bignumber.js";
import appConfig from "../../config";
import { AxiosService } from "./axios/AxiosService";
import { AxelarEvmChainMaintainersGetResponse } from "./interfaces/evm/AxelarEvmChainMaintainersGetResponse";
import { AxelarEvmChainsGetResponse } from "./interfaces/evm/AxelarEvmChainsGetResponse";
import { SlashingParamsGetResponse } from "./interfaces/slashing/SlashingParamsGetResponse";
import { ValSigningInfoGetResponse } from "./interfaces/slashing/ValSigningInfoGetResponse";
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

  /*
  A function that fetches all supported EVM chains and their maintainers from the Axelar API
  with keys being the chain name and values being an array of maintainers
  */
  public async getAxelarAllEvmChainsWithMaintainers(): Promise<
    Map<string, string[]>
  > {
    const supportedChains = (await this.getAxelarEvmChains()).chains;

    const chainsMaintainers: Map<string, string[]> = new Map();

    const promises: Promise<{ chain: string; maintainers: string[] } | null>[] =
      supportedChains.map(async (supportedChain) => {
        try {
          const response = await this.getAxelarChainMaintainers({
            chain: supportedChain,
          });
          return { chain: supportedChain, maintainers: response.maintainers };
        } catch (error) {
          console.error(
            `Could not fetch maintainers for chain ${supportedChain}`
          );
          return null; // Resolve to null if a request fails
        }
      });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result !== null) {
        chainsMaintainers.set(result.chain, result.maintainers);
      }
    }

    return chainsMaintainers;
  }

  public async getValidatorUptime(consensusAddress: string): Promise<number> {
    let uptime = new BigNumber(0);

    const [signingInfo, slashingParams] = await Promise.all([
      this.getValidatorSigningInfo({ consensusAddress }),
      this.getSlahsingParams(),
    ]);
    const missedBlocksCounter = new BigNumber(
      signingInfo.val_signing_info.missed_blocks_counter
    );
    const signedBlocksWindow = new BigNumber(
      slashingParams.params.signed_blocks_window
    );

    uptime = new BigNumber(1).minus(
      missedBlocksCounter.dividedBy(signedBlocksWindow)
    );

    return uptime.decimalPlaces(4).toNumber();
  }

  private async getValidatorSigningInfo({
    consensusAddress,
  }: {
    consensusAddress: string;
  }): Promise<ValSigningInfoGetResponse> {
    const response = await this.restClient.request<ValSigningInfoGetResponse>({
      method: "GET",
      url: `/cosmos/slashing/v1beta1/signing_infos/${consensusAddress}`,
    });

    return response?.data;
  }

  private async getSlahsingParams(): Promise<SlashingParamsGetResponse> {
    const response = await this.restClient.request<SlashingParamsGetResponse>({
      method: "GET",
      url: `/cosmos/slashing/v1beta1/params`,
    });

    return response?.data;
  }

  private async getAxelarEvmChains(): Promise<AxelarEvmChainsGetResponse> {
    const response = await this.restClient.request<AxelarEvmChainsGetResponse>({
      method: "GET",
      url: "/axelar/evm/v1beta1/chains",
    });

    return response?.data;
  }

  private async getAxelarChainMaintainers({
    chain,
  }: {
    chain: string;
  }): Promise<AxelarEvmChainMaintainersGetResponse> {
    const targetChain = chain;
    const response =
      await this.restClient.request<AxelarEvmChainMaintainersGetResponse>({
        method: "GET",
        url: `https://axelar-lcd.quantnode.tech/axelar/nexus/v1beta1/chain_maintainers/${targetChain}`,
      });

    return response?.data;
  }

}
