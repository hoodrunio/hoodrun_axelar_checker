import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import { NewWsPollDto } from "../dto/NewWsPollDtos";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";

export const handleOnNewPoll = async (data: NewWsPollDto) => {
  const { pollChain, pollId, txHash, txHeight, participants, pollState } = data;
  const { pollRepo, validatorRepository, pollVoteRepo } = new AppDb();

  try {
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

    try {
      const allParticipantVals = await validatorRepository.findAll({
        voter_address: { $in: participants },
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
    } catch (error) {
      logger.error(
        `Error creating bulk votes for pollId: ${poll?.pollId} ${error}`
      );
    }

    logger.info(`New poll added pollId: ${poll?.pollId}`);
  } catch (error) {
    logger.error(`Error adding new poll to db ${error}`);
  }
};
