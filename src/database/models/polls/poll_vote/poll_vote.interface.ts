import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum PollVoteType {
  YES = "YES",
  NO = "NO",
  UNSUBMITTED = "UNSUBMITTED",
}

export interface IPollVote extends IBaseInterface {
  customId: string;
  pollId: string;
  pollState: string;
  voter_address: string;
  vote: PollVoteType;
  txHash: string;
  txHeight: number;
  checkedForNotification?: boolean;
}

export interface IPollVoteDocument extends Document, IPollVote {}

export interface IPollVoteVoteModel
  extends IBaselModel<IPollVote, IPollVoteDocument> {}

export const genPollVoteCustomId = (pollId: string, voter_address: string) =>
  `${pollId}_${voter_address}`;
