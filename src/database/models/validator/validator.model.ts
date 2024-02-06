import { model, Schema } from "mongoose";
import { IValidatorDocument } from "./validator.interface";
import { createAppSchema } from "src/database/helper";

const VALIDATOR_COLLECTION_NAME = "validators";

const ValidatorSchema: Schema<IValidatorDocument> =
  createAppSchema<IValidatorDocument>({
    operatorAddress: { type: String, required: true, unique: true },
  });

ValidatorSchema.statics.buildModel = (args: IValidatorDocument) => {
  return new ValidatorDbModel(args);
};

const ValidatorDbModel = model<IValidatorDocument>(
  VALIDATOR_COLLECTION_NAME,
  ValidatorSchema
);

export default ValidatorDbModel;
