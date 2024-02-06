import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Chat } from "grammy/types";
import { Document } from "mongoose";

export enum TelegramChatType {
  PRIVATE = "private",
  GROUP = "group",
  SUPERGROUP = "supergroup",
  CHANNEL = "channel",
}

export interface ITelegramUser extends IBaseInterface {
  operator_addresses: string[];
  chat_id: number;
  first_name: string;
  username: string;
  type: TelegramChatType;
  _chat: Chat;
}

export interface ITelegramUserDocument extends Document, ITelegramUser {}

export interface ITelegramUserModel
  extends IBaselModel<ITelegramUser, ITelegramUserDocument> {}
