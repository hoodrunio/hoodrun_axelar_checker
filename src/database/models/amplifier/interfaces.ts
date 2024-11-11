import { AmplifierVoteType } from "@/types/amplifier";

export interface IAmplifierPoll {
  pollId: string;
  sourceChain: string;
  participants: string[];
  confirmationHeight: number;
  expiresAt: number;
  messages: IAmplifierMessage[];
  contractAddress: string;
  sourceGatewayAddress: string;
  txHash: string;
  txHeight: number;
  pollState: AmplifierPollState;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAmplifierVote {
  customId: string;
  pollId: string;
  voterAddress: string;
  vote: AmplifierVoteType;
  txHash?: string;
  txHeight?: number;
  checkedForNotification: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAmplifierMessage {
  tx_id: string;
  event_index: number;
  destination_address: string;
  destination_chain: string;
  source_address: string;
  payload_hash: string;
}

export enum AmplifierPollState {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

export interface ITxResponse {
  data: {
    txs: Array<{
      body: {
        messages: Array<{
          '@type': string;
          msg?: {
            vote?: {
              poll_id?: string;
              votes?: string[];
            };
          };
        }>;
      };
      txhash: string;
      height: string;
    }>;
  };
}

export interface ITxMessage {
  '@type': string;
  msg?: {
    vote?: {
      poll_id?: string;
      votes?: string[];
    };
  };
  inner_message?: {
    vote?: {
      events?: any[];
    };
  };
}