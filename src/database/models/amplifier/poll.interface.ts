import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface VoteResponse {
  tx_responses: Array<{
    tx: {
      body: {
        messages: Array<{
          sender: string;
          msg?: {
            vote?: {
              poll_id: string;
              votes: string[];
            };
          };
        }>;
      };
    };
  }>;
  pagination: {
    next_key: string | null;
    total: string;
  };
}

export interface PollStartedEvent {
  source_chain: string;
  poll_id: string;
  participants: string[];
  expires_at: number | string;
  height: number | string;
  hash: string;
}

export interface VoteInfo {
  voter: string;
  vote: VoteType;
  votedAt?: number;
  lastChecked?: number;
}
  
export enum VoteType {
  YES = 'Yes',
  NO = 'No',
  UNSUBMITTED = 'Unsubmitted'
}

export interface IAmplifierPoll extends IBaseInterface {
  pollId: string;
  sourceChain: string;
  participants: string[];
  expiresAt: number;
  height: number;
  hash: string;
  status: PollStatus;
  votes: VoteInfo[];
  timestamp?: number;
}

export interface IAmplifierPollDocument extends Document, IAmplifierPoll {}

export interface IAmplifierPollModel extends IBaselModel<IAmplifierPoll, IAmplifierPollDocument> {}

export enum PollStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  FAILED = 'Failed'
}