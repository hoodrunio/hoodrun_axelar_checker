import {
  IPollVoteDocument,
  PollVoteType,
} from "@/database/models/polls/poll_vote/poll_vote.interface";
import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";

const POLL_VOTES_COLLECTION_NAME = "poll_votes";

const PollVoteSchema: Schema<IPollVoteDocument> =
  createAppSchema<IPollVoteDocument>({
    customId: {
      type: String,
      required: true,
      unique: true,
    },
    pollId: {
      type: String,
      required: true,
    },
    pollState: {
      type: String,
      required: true,
    },
    pollChain: {
      type: String,
      required: true,
    },
    voter_address: {
      type: String,
      required: true,
    },
    vote: {
      type: String,
      required: true,
      enum: Object.values(PollVoteType),
      default: PollVoteType.UNSUBMITTED,
    },
    txHash: {
      type: String,
      required: true,
    },
    txHeight: {
      type: Number,
      required: true,
    },
    checkedForNotification: {
      type: Boolean,
      default: false,
    },
  });

PollVoteSchema.statics.buildModel = (args: IPollVoteDocument) => {
  return new PollVoteDbModel(args);
};

const PollVoteDbModel = model<IPollVoteDocument>(
  POLL_VOTES_COLLECTION_NAME,
  PollVoteSchema
);

export default PollVoteDbModel;
