import { IPollVote } from "@database/models/polls/poll_vote/poll_vote.interface";

export const createPollVoteCondition = (params: IPollVote): string => {
  const { pollId, voter_address } = params;
  return `${pollId}_${voter_address}`;
};
