import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface VoteInfo {
  voter: string;
  vote: 'Yes' | 'No' | 'Unsubmitted';
  votedAt?: number;
}

export interface IAmplifierPoll extends IBaseInterface {
  pollId: string;
  sourceChain: string;
  participants: string[];
  expiresAt: number;
  height: number;
  hash: string;
  status: 'Pending' | 'Completed' | 'Failed';
  votes: VoteInfo[];
}

export interface IAmplifierPollDocument extends Document, IAmplifierPoll {}

export interface IAmplifierPollModel extends IBaselModel<IAmplifierPoll, IAmplifierPollDocument> {}