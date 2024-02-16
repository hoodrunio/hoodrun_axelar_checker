import { AppDb } from "@database/database";
import { PollStateEnum } from "@database/models/polls/poll/poll.interface";
import {
  PollVoteType,
  genPollVoteCustomId,
} from "@database/models/polls/poll_vote/poll_vote.interface";
import { AxelarQueryService } from "@services/rest/AxelarQueryService";
import { NewWsPollVoteDto } from "../dto/NewWsPollDtos";

export const handleOnNewPollVote = async (
  data: Omit<NewWsPollVoteDto, "vote">
) => {
  const { pollId, pollState, voter_address, txHash, txHeight } = data;
  const { pollVoteRepo, pollRepo } = new AppDb();
  const axlQueryService = new AxelarQueryService();

  let voteState = PollVoteType.UNSUBMITTED;

  const tx = await axlQueryService.getTxWithHash(txHash);
  const txInnerMessageEvents = tx.tx.body.messages.find(
    (msg) => msg?.inner_message
  )?.inner_message?.vote?.events;

  if (txInnerMessageEvents && txInnerMessageEvents?.length > 0) {
    voteState = PollVoteType.YES;
  }

  if (txInnerMessageEvents && txInnerMessageEvents?.length === 0) {
    voteState = PollVoteType.NO;
  }

  const customId = genPollVoteCustomId(pollId, voter_address);
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

  if (pollState !== PollStateEnum.POLL_STATE_PENDING) {
    await pollRepo.updateOne({ pollId }, { pollState });
  }

  // logger.info(`New poll vote added pollId: ${poll?.pollId} ${voter_address}`);
};
