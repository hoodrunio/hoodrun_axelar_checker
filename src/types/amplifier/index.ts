export enum AmplifierEventType {
  POLL_STARTED = "wasm-messages_poll_started",
  SIGNING_STARTED = "wasm-signing_started",
  VOTE_SUBMITTED = "wasm-voted",
  SIGNATURE_SUBMITTED = "wasm-signature_submitted"
}

export enum AmplifierVoteType {
  YES = "YES",
  NO = "NO",
  UNSUBMITTED = "UNSUBMITTED"
}

export interface IAmplifierMessage {
  tx_id: string;
  event_index: number;
  destination_address: string;
  destination_chain: string;
  source_address: string;
  payload_hash: string;
}

export interface IAmplifierPollAttributes {
  pollId: string;
  sourceChain: string;
  participants: string[];
  confirmationHeight: number;
  expiresAt: number;
  messages: {
    tx_id: string;
    event_index: number;
    destination_address: string;
    destination_chain: string;
    source_address: string;
    payload_hash: string;
  }[];
  contractAddress: string;
  sourceGatewayAddress: string;
}

export interface IDecodedPollAttributes {
  pollId: string;
  sourceChain: string;
  participants: string[];
  confirmationHeight: number;
  expiresAt: number;
  messages: IAmplifierMessage[];
  contractAddress: string;
  sourceGatewayAddress: string;
}

export interface IDecodedSigningAttributes {
  sessionId: string;
  chain: string;
  contractAddress: string;
  verifierSetId: string;
  pubKeys: {
    [key: string]: {
      ecdsa: string;
    };
  };
} 