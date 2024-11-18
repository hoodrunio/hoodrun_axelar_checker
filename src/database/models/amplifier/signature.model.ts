import { IAmplifierSignatureDocument } from "./signature.interface";
import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";

const AMPLIFIER_SIGNATURE_COLLECTION_NAME = "amplifier_signatures";

const PubKeyInfoSchema = new Schema({
  address: { type: String, required: true },
  ecdsaKey: { type: String, required: true }
});

const SignatureInfoSchema = new Schema({
  verifier: { type: String, required: true },
  status: { 
    type: String, 
    required: true,
    enum: ['Yes', 'Unsubmitted', 'Invalid']
  },
  submittedAt: { type: Number }
});

const AmplifierSignatureSchema: Schema<IAmplifierSignatureDocument> = createAppSchema<IAmplifierSignatureDocument>({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  chain: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  pubKeys: {
    type: [PubKeyInfoSchema],
    required: true
  },
  verifierSetId: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  hash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Completed', 'Failed']
  },
  signatures: {
    type: [SignatureInfoSchema],
    default: []
  }
});

AmplifierSignatureSchema.statics.buildModel = (args: IAmplifierSignatureDocument) => {
  return new AmplifierSignatureDbModel(args);
};

const AmplifierSignatureDbModel = model<IAmplifierSignatureDocument>(
  AMPLIFIER_SIGNATURE_COLLECTION_NAME,
  AmplifierSignatureSchema
);

export default AmplifierSignatureDbModel; 