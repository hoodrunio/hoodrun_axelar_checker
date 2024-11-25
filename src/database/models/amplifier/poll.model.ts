import { IAmplifierPollDocument } from "./poll.interface";
import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";

const AMPLIFIER_POLL_COLLECTION_NAME = "amplifier_polls";

const VoteInfoSchema = new Schema({
  voter: { type: String, required: true },
  vote: { 
    type: String, 
    required: true,
    enum: ['Yes', 'No', 'Unsubmitted']
  },
  votedAt: { type: Number },
  lastChecked: { type: Number }
});

const AmplifierPollSchema: Schema<IAmplifierPollDocument> = createAppSchema<IAmplifierPollDocument>({
  pollId: {
    type: String,
    required: true,
    unique: true
  },
  sourceChain: {
    type: String,
    required: true
  },
  participants: {
    type: [String],
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
    enum: {
      values: ['Pending', 'Completed', 'Failed'],
      message: '{VALUE} is not a valid status'
    }
  },
  votes: {
    type: [VoteInfoSchema],
    default: []
  }
});

AmplifierPollSchema.statics.buildModel = (args: IAmplifierPollDocument) => {
  return new AmplifierPollDbModel(args);
};

const AmplifierPollDbModel = model<IAmplifierPollDocument>(
  AMPLIFIER_POLL_COLLECTION_NAME,
  AmplifierPollSchema
);

export default AmplifierPollDbModel; 