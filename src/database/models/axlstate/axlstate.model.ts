import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";
import { IAxlStateDocument } from "./axlstate.interface";

const AXLSTATE_COLLECTION_NAME = "axlstate";

const AxlStateSchema: Schema<IAxlStateDocument> =
  createAppSchema<IAxlStateDocument>({
    customId: {
      type: String,
      required: true,
      unique: true,
    },
    latestHeight: {
      type: Number,
      required: true,
      default: 0,
    },
    latestPollCheckHeight: {
      type: Number,
      required: false,
      default: 0,
    },
  });

AxlStateSchema.statics.buildModel = (args: IAxlStateDocument) => {
  return new AxlStateDbModel(args);
};

const AxlStateDbModel = model<IAxlStateDocument>(
  AXLSTATE_COLLECTION_NAME,
  AxlStateSchema
);

export default AxlStateDbModel;
