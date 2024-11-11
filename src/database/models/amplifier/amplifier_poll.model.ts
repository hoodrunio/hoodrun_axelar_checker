import { Schema, model } from 'mongoose';
import { AmplifierPollState, IAmplifierPoll } from './interfaces';
import { AmplifierPollDocument } from '@/repositories/amplifier/AmplifierPollRepository';

const AmplifierPollSchema = new Schema<AmplifierPollDocument>(
  {
    pollId: { type: String, required: true },
    sourceChain: { type: String, required: true },
    participants: [{ type: String }],
    confirmationHeight: { type: Number },
    expiresAt: { type: Number },
    txHash: { type: String },
    txHeight: { type: Number },
    pollState: { type: String, enum: AmplifierPollState },
    messages: { type: Schema.Types.Mixed },
    contractAddress: { type: String },
    sourceGatewayAddress: { type: String }
  },
  {
    timestamps: true,
  }
);

export const AmplifierPollModel = model<AmplifierPollDocument>('amplifier_polls', AmplifierPollSchema); 