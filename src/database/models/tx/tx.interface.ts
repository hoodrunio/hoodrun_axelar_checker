import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface ITx extends IBaseInterface {
  height: number;
  tx_raw: string;
  messageAction: string;
}

export interface ITxDocument extends Document, ITx {}

export interface ITxModel extends IBaselModel<ITx, ITxDocument> {}
