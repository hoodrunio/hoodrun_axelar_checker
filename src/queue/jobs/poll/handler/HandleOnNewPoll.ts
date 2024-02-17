import { NewWsPollDto } from "@/queue/jobs/poll/dto/NewWsPollDtos";
import { AppDb } from "@database/database";

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

  // const allParticipantVals = await validatorRepository.findAll({
  //   operator_address: { $in: participants },
  // });

  // const voteCreatePromises = allParticipantVals.map(async (val) => {
  //   await pollVoteRepo.create({
  //     customId: genPollVoteCustomId(pollId, val.voter_address),
  //     pollId,
  //     voter_address: val.voter_address,
  //     vote: PollVoteType.UNSUBMITTED,
  //     txHash,
  //     txHeight,
  //     pollState,
  //   });
  // });

  // await Promise.all(voteCreatePromises);
};
