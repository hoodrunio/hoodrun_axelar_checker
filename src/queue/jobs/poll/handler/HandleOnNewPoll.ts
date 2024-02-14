import { AppDb } from "@database/database";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import { NewWsPollDto } from "../dto/NewWsPollDtos";

export const handleOnNewPoll = async (data: NewWsPollDto) => {
  const { pollChain, pollId, txHash, txHeight, participants, pollState } = data;
  const { pollRepo, validatorRepository, pollVoteRepo } = new AppDb();

  const poll = await pollRepo.upsertOne(
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

  const allParticipantVals = await validatorRepository.findAll({
    operator_address: { $in: participants },
  });

  const voteCreatePromises = allParticipantVals.map(async (val) => {
    await pollVoteRepo.create({
      pollId,
      voter_address: val.voter_address,
      vote: PollVoteType.UNSUBMITTED,
      txHash,
      txHeight,
      pollState,
    });
  });

  await Promise.all(voteCreatePromises);
};
