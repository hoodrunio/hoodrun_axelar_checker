import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum PollState {
  POLL_STATE_PENDING = "POLL_STATE_PENDING",
  POLL_STATE_FAILED = "POLL_STATE_FAILED",
  POLL_STATE_COMPLETED = "POLL_STATE_COMPLETED",
}

export interface IPoll extends IBaseInterface {
  pollId: string;
  pollChain: string;
  pollState: PollState;
  participants: string[];
  txHash: string;
  txHeight: number;
}

export interface IPollDocument extends Document, IPoll {}

export interface IPollModel extends IBaselModel<IPoll, IPollDocument> {}

export const pollStateEnumFromString = (state: string): PollState => {
  switch (state) {
    case "POLL_STATE_PENDING":
      return PollState.POLL_STATE_PENDING;
    case "POLL_STATE_FAILED":
      return PollState.POLL_STATE_FAILED;
    case "POLL_STATE_COMPLETED":
      return PollState.POLL_STATE_COMPLETED;
    default:
      return state as never;
  }
};
