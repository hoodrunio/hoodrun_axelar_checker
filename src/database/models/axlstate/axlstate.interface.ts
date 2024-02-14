import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface IAxlState extends IBaseInterface {
  customId?: string;
  latestHeight: number;
  latestPollCheckHeight: number;
}

export interface IAxlStateDocument extends Document, IAxlState {}

export interface IAxlStateModel
  extends IBaselModel<IAxlState, IAxlStateDocument> {}
