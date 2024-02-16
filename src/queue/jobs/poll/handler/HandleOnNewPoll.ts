import { AppDb } from "@database/database";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import { NewWsPollDto } from "../dto/NewWsPollDtos";
import { genPollVoteCustomId } from "@database/models/polls/poll_vote/poll_vote.model";

export const handleOnNewPoll = async (data: NewWsPollDto) => {
  const { pollChain, pollId, txHash, txHeight, participants, pollState } = data;
  const { pollRepo } = new AppDb();

  await pollRepo.upsertOne(
    { pollId },
    {
      pollId,
      pollChain,
      pollState,
      participants,
      txHash,
      txHeight,
    }
  );
};
