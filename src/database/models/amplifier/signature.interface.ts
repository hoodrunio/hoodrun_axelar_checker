import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface SignatureResponse {
  txs: any[];
  tx_responses: {
    height: string;
    txhash: string;
    tx: {
      body: {
        messages: Array<{
          '@type': string;
          sender: string;
          contract: string;
          msg: {
            submit_signature?: {
              session_id: string;
              signature?: string;
            };
          };
          funds: any[];
        }>;
      };
    };
  }[];
  pagination: {
    total: string;
  };
}

export interface SigningStartedEvent {
  chain: string;
  _contract_address: string;
  pub_keys: Record<string, { ecdsa: string }>;
  session_id: string;
  verifier_set_id: string;
  expires_at: number | string;
  height: number | string;
  hash: string;
}

export interface PubKeyInfo {
  address: string;
  ecdsaKey: string;
}

export interface SignatureInfo {
  verifier: string;
  status: SignatureType;
  submittedAt?: number;
  lastChecked?: number;
}

export enum SignatureType {
  YES = 'Yes',
  UNSUBMITTED = 'Unsubmitted',
  INVALID = 'Invalid'
}

export enum SignatureStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  FAILED = 'Failed'
}

export interface IAmplifierSignature extends IBaseInterface {
  sessionId: string;
  chain: string;
  contractAddress: string;
  pubKeys: PubKeyInfo[];
  verifierSetId: string;
  expiresAt: number;
  height: number;
  hash: string;
  status: SignatureStatus;
  signatures: SignatureInfo[];
}

export interface IAmplifierSignatureDocument extends Document, IAmplifierSignature {}

export interface IAmplifierSignatureModel extends IBaselModel<IAmplifierSignature, IAmplifierSignatureDocument> {}

export interface SigningCompletedEvent {
  session_id: string;
  chain: string;
  completed_at: string | number;
}