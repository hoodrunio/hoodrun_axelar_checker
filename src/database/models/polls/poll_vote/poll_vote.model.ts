import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";
import { IPollVoteDocument, PollVoteType } from "./poll_vote.interface";
import { PollState } from "../poll/poll.interface";

const POLL_VOTES_COLLECTION_NAME = "poll_votes";

const PollVoteSchema: Schema<IPollVoteDocument> =
  createAppSchema<IPollVoteDocument>({
    pollId: {
      type: String,
      required: true,
    },
    pollState: {
      type: String,
      required: true,
      enum: Object.values(PollState),
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
  });

PollVoteSchema.statics.buildModel = (args: IPollVoteDocument) => {
  return new PollVoteDbModel(args);
};

const PollVoteDbModel = model<IPollVoteDocument>(
  POLL_VOTES_COLLECTION_NAME,
  PollVoteSchema
);

export default PollVoteDbModel;
