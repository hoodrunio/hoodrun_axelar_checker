import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import {
  Commission,
  ConsensusPubkey,
  Description,
} from "@services/rest/interfaces/validators/validator";
import { Document } from "mongoose";

export interface ValRpcHealthEndpoint {
  name: string;
  isHealthy: boolean;
  rpcEndpoint: string;
}

export interface IValidator extends IBaseInterface {
  operator_address: string;
  consensus_address: string;
  voter_address: string;
  consensus_pubkey: ConsensusPubkey;
  jailed: boolean;
  status: string;
  tokens: string;
  delegator_shares: string;
  description: Description;
  unbonding_height: string;
  unbonding_time: string;
  commission: Commission;
  min_self_delegation: string;
  supported_evm_chains: string[];
  uptime: number;
  is_active: boolean;
  rpc_health_endpoints?: ValRpcHealthEndpoint[];
}

export interface IValidatorDocument extends Document, IValidator {}

export interface IValidatorModel
  extends IBaselModel<IValidator, IValidatorDocument> {}
