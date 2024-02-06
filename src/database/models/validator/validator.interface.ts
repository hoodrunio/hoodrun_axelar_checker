import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import {
  Commission,
  ConsensusPubkey,
  Description,
} from "@services/rest/interfaces/validators/validator";
import { Document } from "mongoose";

export interface IValidator extends IBaseInterface {
  operator_address: string;
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
}

export interface IValidatorDocument extends Document, IValidator {}

export interface IValidatorModel
  extends IBaselModel<IValidator, IValidatorDocument> {}