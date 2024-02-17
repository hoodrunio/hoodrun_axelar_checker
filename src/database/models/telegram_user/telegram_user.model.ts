import { model, Schema } from "mongoose";

import { createAppSchema } from "@database/helper";
import {
  ITelegramUserDocument,
  TelegramChatType,
} from "@/database/models/telegram_user/telegram_user.interface";

const TELEGRA_USER_COLLECTION_NAME = "telegram_users";

const TelegramUserSchema: Schema<ITelegramUserDocument> =
  createAppSchema<ITelegramUserDocument>({
    operator_addresses: { type: [String], required: true, default: [] },
    chat_id: {
      type: Number,
      required: true,
      unique: true,
    },
    first_name: {
      type: String,
    },
    username: {
      type: String,
    },
    type: {
      type: String,
      enum: Object.values(TelegramChatType),
      required: true,
    },
    _chat: {
      type: Object,
    },
  });

TelegramUserSchema.statics.buildModel = (args: ITelegramUserDocument) => {
  return new TelegramUserDbModel(args);
};

const TelegramUserDbModel = model<ITelegramUserDocument>(
  TELEGRA_USER_COLLECTION_NAME,
  TelegramUserSchema
);

export default TelegramUserDbModel;
