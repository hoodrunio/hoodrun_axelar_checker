import { Document } from "mongoose";
import { IBaseInterface, IBaselModel } from "src/database/base/model.interface";

export interface IValidator extends IBaseInterface {
  operatorAddress: string;
}

export interface IValidatorDocument extends Document, IValidator {}

export interface IValidatorModel
  extends IBaselModel<IValidator, IValidatorDocument> {}
