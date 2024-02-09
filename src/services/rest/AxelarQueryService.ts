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
import { logger } from "@utils/logger";

export class AxelarQueryService {
  restClient: AxiosService;

  constructor() {
    this.restClient = new AxiosService({
      baseUrls: appConfig.mainnetAxelarRestBaseUrls,
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
          logger.error(
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

  async getSafeValidatorUptime(
    consensusAddress: string,
    defaultValue?: number
  ): Promise<number> {
    let uptime = defaultValue ?? 0.0;
    try {
      uptime = await this.getValidatorUptime(consensusAddress);
    } catch (error) {
      logger.error(`Could not fetch uptime for ${consensusAddress}`);
      uptime = 0.0;
    }

    return uptime;
  }

  async updateValidatorsPropsOnDb() {
    const validatorRepo = new ValidatorRepository();
    const [validatorsRes, allEvmChainsWithMaintainersRes] = await Promise.all([
      this.getAllValidators(),
      this.getAxelarAllEvmChainsWithMaintainers(),
    ]);
    const validators = validatorsRes.validators;
    const chainsMaintainers = allEvmChainsWithMaintainersRes;

    const promises = validators.map(async (validator) => {
      const valEvmSupportedChains: string[] = [];
      const operatorAddress = validator.operator_address;

      for (const [chain, maintainers] of chainsMaintainers.entries()) {
        if (maintainers.includes(operatorAddress)) {
          valEvmSupportedChains.push(chain);
        }
      }

      const consensusAddress = convertPubKeyToBech32(
        validator.consensus_pubkey,
        ADDRESS_TYPE_PREFIX.VALCONSENSUS
      );

      const uptime = await this.getSafeValidatorUptime(consensusAddress);
      const is_active = validator.status == "BOND_STATUS_BONDED";

      try {
        await validatorRepo.upsertOne(
          { operator_address: operatorAddress },
          {
            operator_address: operatorAddress,
            consensus_address: consensusAddress,
            consensus_pubkey: validator.consensus_pubkey,
            jailed: validator.jailed,
            status: validator.status,
            tokens: validator.tokens,
            delegator_shares: validator.delegator_shares,
            description: validator.description,
            unbonding_height: validator.unbonding_height,
            unbonding_time: validator.unbonding_time,
            commission: validator.commission,
            min_self_delegation: validator.min_self_delegation,
            supported_evm_chains: valEvmSupportedChains,
            uptime,
            is_active,
          }
        );
      } catch (error) {
        logger.error(`Failed to create validator: ${error}`);
      }
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      logger.error(`Failed to concurrent update validators: ${error}`);
    }
  }
}
