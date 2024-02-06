import { model, Schema } from "mongoose";
import { IValidatorDocument } from "./validator.interface";
import { createAppSchema } from "@database/helper";

const VALIDATOR_COLLECTION_NAME = "validators";

const ValidatorSchema: Schema<IValidatorDocument> =
  createAppSchema<IValidatorDocument>({
    operator_address: { type: String, required: true, unique: true },
    consensus_pubkey: {
      "@type": { type: String, required: true },
      key: { type: String, required: true },
    },
    jailed: { type: Boolean, required: true },
    status: { type: String, required: true },
    tokens: { type: String, required: true },
    delegator_shares: { type: String, required: true },
    description: {
      moniker: { type: String },
      identity: { type: String },
      website: { type: String },
      security_contact: { type: String },
      details: { type: String },
    },
    unbonding_height: { type: String, required: true },
    unbonding_time: { type: String, required: true },
    commission: {
      commission_rates: {
        rate: { type: String, required: true },
        max_rate: { type: String, required: true },
        max_change_rate: { type: String, required: true },
      },
      update_time: { type: String, required: true },
    },
    min_self_delegation: { type: String, required: true },
  });

ValidatorSchema.statics.buildModel = (args: IValidatorDocument) => {
  return new ValidatorDbModel(args);
};

const ValidatorDbModel = model<IValidatorDocument>(
  VALIDATOR_COLLECTION_NAME,
  ValidatorSchema
);

export default ValidatorDbModel;
