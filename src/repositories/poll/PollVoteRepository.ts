import {
  IPollVote,
  IPollVoteDocument,
} from "@database/models/polls/poll_vote/poll_vote.interface";
import PollVoteDbModel from "@database/models/polls/poll_vote/poll_vote.model";
import BaseRepository from "@repositories/base.repository";

export class PollVoteRepository extends BaseRepository<
  IPollVote,
  IPollVoteDocument
> {
  constructor() {
    super(PollVoteDbModel);
  }
}
