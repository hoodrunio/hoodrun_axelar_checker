import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";
import { PollState } from "../poll/poll.interface";

export enum PollVoteType {
  YES = "YES",
  NO = "NO",
  UNSUBMITTED = "UNSUBMITTED",
}

export interface IPollVote extends IBaseInterface {
  pollId: string;
  pollState: PollState;
  voter_address: string;
  vote: PollVoteType;
  txHash: string;
  txHeight: number;
}

export interface IPollVoteDocument extends Document, IPollVote {}

export interface IPollVoteVoteModel
  extends IBaselModel<IPollVote, IPollVoteDocument> {}
