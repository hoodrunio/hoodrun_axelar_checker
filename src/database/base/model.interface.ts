import { Model } from "mongoose";

export interface IBaseInterface {
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface IBaselModel<T, TDocument> extends Model<TDocument> {
  buildModel(args: T): TDocument;
}
