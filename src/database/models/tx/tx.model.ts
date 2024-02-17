import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";
import { ITxDocument } from "./tx.interface";

const TX_COLLECTION_NAME = "txs";

const TxSchema: Schema<ITxDocument> = createAppSchema<ITxDocument>({
  height: {
    type: Number,
    required: true,
  },
  tx_raw: {
    type: String,
    required: true,
  },
  messageAction: {
    type: String,
    required: true,
  },
});

TxSchema.statics.buildModel = (args: ITxDocument) => {
  return new TxDbModel(args);
};

const TxDbModel = model<ITxDocument>(TX_COLLECTION_NAME, TxSchema);

export default TxDbModel;
