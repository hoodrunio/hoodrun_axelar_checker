import { SchemaDefinition, Schema, Document } from "mongoose";
import { IBaseInterface } from "./base/model.interface";

type AppSchemaBuilderReturnType<T> = T & IBaseInterface;

export const createAppSchema = <T extends Document>(
  definition: SchemaDefinition
): Schema<AppSchemaBuilderReturnType<T>> => {
  return new Schema<AppSchemaBuilderReturnType<T>>(
    {
      ...definition,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );
};
