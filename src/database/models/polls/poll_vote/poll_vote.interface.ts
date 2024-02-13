import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum PollVoteType {
  YES = "YES",
  NO = "NO",
  UNSUBMITTED = "UNSUBMITTED",
}

export interface IPollVote extends IBaseInterface {
  pollId: string;
  pollState: string;
  voter_address: string;
  vote: PollVoteType;
  txHash: string;
  txHeight: number;
}

export interface IPollVoteDocument extends Document, IPollVote {}

export interface IPollVoteVoteModel
  extends IBaselModel<IPollVote, IPollVoteDocument> {}
