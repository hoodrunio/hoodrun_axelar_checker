import { AppDb } from "@database/database";
import { NewWsPollVoteDto } from "../dto/NewWsPollDtos";
import { AxelarQueryService } from "@services/rest/AxelarQueryService";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import { logger } from "@utils/logger";
import { PollStateEnum } from "@database/models/polls/poll/poll.interface";
import { genPollVoteCustomId } from "@database/models/polls/poll_vote/poll_vote.model";

export const handleOnNewPollVote = async (
  data: Omit<NewWsPollVoteDto, "vote">
) => {
  const { pollId, pollState, voter_address, txHash, txHeight } = data;
  const { pollVoteRepo, pollRepo } = new AppDb();
  const axlQueryService = new AxelarQueryService();

  let voteState = PollVoteType.UNSUBMITTED;
  let tx = null;
  try {
    tx = await axlQueryService.getTxWithHash(txHash);
  } catch (error) {
    logger.error(`Error fetching tx with hash ${txHash}`);
    return;
  }

  const txInnerMessageEvents = tx.tx.body.messages.find(
    (msg) => msg?.inner_message
  )?.inner_message?.vote?.events;

  if (!txInnerMessageEvents || txInnerMessageEvents?.length === 0) {
    voteState = PollVoteType.NO;
  }

  if (txInnerMessageEvents && txInnerMessageEvents?.length > 0) {
    voteState = PollVoteType.YES;
  }

  const customId = genPollVoteCustomId(pollId, voter_address);

  try {
    await pollVoteRepo.upsertOne(
      { customId },
      {
        customId,
        pollId,
        pollState,
        voter_address,
        vote: voteState,
        txHash,
        txHeight,
      }
    );
  } catch (error) {
    logger.error(`Error upserting poll vote ${customId} ${error}`);
    return;
  }

  if (pollState !== PollStateEnum.POLL_STATE_PENDING) {
    await pollRepo.updateOne({ pollId }, { pollState });
  }

  // logger.info(`New poll vote added pollId: ${poll?.pollId} ${voter_address}`);
};
