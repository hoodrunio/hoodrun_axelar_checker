import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export interface PubKeyInfo {
  address: string;
  ecdsaKey: string;
}

export interface SignatureInfo {
  verifier: string;
  status: 'Yes' | 'Unsubmitted' | 'Invalid';
  submittedAt?: number;
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
  status: 'Pending' | 'Completed' | 'Failed';
  signatures: SignatureInfo[];
}

export interface IAmplifierSignatureDocument extends Document, IAmplifierSignature {}

export interface IAmplifierSignatureModel extends IBaselModel<IAmplifierSignature, IAmplifierSignatureDocument> {}