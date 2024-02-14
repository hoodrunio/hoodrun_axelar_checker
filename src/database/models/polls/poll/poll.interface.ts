import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum PollStateEnum {
  POLL_STATE_PENDING = "POLL_STATE_PENDING",
  POLL_STATE_FAILED = "POLL_STATE_FAILED",
  POLL_STATE_COMPLETED = "POLL_STATE_COMPLETED",
}

export interface IPoll extends IBaseInterface {
  pollId: string;
  pollChain: string;
  pollState: string;
  participants: string[];
  txHash: string;
  txHeight: number;
}

export interface IPollDocument extends Document, IPoll {}

export interface IPollModel extends IBaselModel<IPoll, IPollDocument> {}

export const pollStateEnumFromString = (state: string): PollStateEnum => {
  switch (state) {
    case "POLL_STATE_PENDING":
      return PollStateEnum.POLL_STATE_PENDING;
    case "POLL_STATE_FAILED":
      return PollStateEnum.POLL_STATE_FAILED;
    case "POLL_STATE_COMPLETED":
      return PollStateEnum.POLL_STATE_COMPLETED;
    default:
      return state as never;
  }
};

export const stringFromPollStateEnum = (state: PollStateEnum): string => {
  switch (state) {
    case PollStateEnum.POLL_STATE_PENDING:
      return "POLL_STATE_PENDING";
    case PollStateEnum.POLL_STATE_FAILED:
      return "POLL_STATE_FAILED";
    case PollStateEnum.POLL_STATE_COMPLETED:
      return "POLL_STATE_COMPLETED";
    default:
      throw new Error(`Invalid PollStateEnum: ${state}`);
  }
};
