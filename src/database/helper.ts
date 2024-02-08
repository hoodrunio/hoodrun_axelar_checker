import { SchemaDefinition, Schema, Document } from "mongoose";
import { IBaseInterface } from "./base/model.interface";
import BigNumber from "bignumber.js";

type AppSchemaBuilderReturnType<T> = T & IBaseInterface;

export const createAppSchema = <T extends Document>(
  definition: SchemaDefinition
): Schema<AppSchemaBuilderReturnType<T>> => {
  return new Schema<AppSchemaBuilderReturnType<T>>(
    {
      ...definition,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
  );
};

export interface ModelNumberPrecisionFixerParams {
  value?: number;
  defaultValue?: number;
  precision?: number;
}

export const modelNumberPrecisionFixer = (
  params: ModelNumberPrecisionFixerParams
): number => {
  const { value, defaultValue, precision = 5 } = params;
  const tempValue = value || defaultValue || 0;
  const finalValue = new BigNumber(tempValue);

  return finalValue.decimalPlaces(precision).toNumber();
};
