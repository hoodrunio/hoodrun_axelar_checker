import { Schema, model } from 'mongoose';
import { IAmplifierVote } from './interfaces';
import { AmplifierVoteType } from '@/types/amplifier';
import { AmplifierVoteDocument } from '@/repositories/amplifier/AmplifierVoteRepository';

const AmplifierVoteSchema = new Schema<AmplifierVoteDocument>(
  {
    customId: { type: String, required: true, unique: true },
    pollId: { type: String, required: true },
    voterAddress: { type: String, required: true },
    vote: { 
      type: String, 
      enum: Object.values(AmplifierVoteType),
      default: AmplifierVoteType.UNSUBMITTED 
    },
    txHash: { type: String },
    txHeight: { type: Number },
    checkedForNotification: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

export const AmplifierVoteModel = model<AmplifierVoteDocument>('amplifier_votes', AmplifierVoteSchema); 