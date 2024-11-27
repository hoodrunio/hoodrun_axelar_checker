import { NewWsPollVoteDto } from "@/queue/jobs/poll/dto/NewWsPollDtos";
import { AppDb } from "@database/database";
import { PollStateEnum } from "@database/models/polls/poll/poll.interface";
import {
  PollVoteType,
  genPollVoteCustomId,
} from "@database/models/polls/poll_vote/poll_vote.interface";
import { AxelarQueryService } from "@services/rest/AxelarQueryService";

export const handleOnNewPollVote = async (
  data: Omit<NewWsPollVoteDto, "vote">
) => {
  const { pollId, pollState, voter_address, txHash, txHeight } = data;
  const { pollVoteRepo, pollRepo } = new AppDb();
  const axlQueryService = new AxelarQueryService();

  let voteState = PollVoteType.UNSUBMITTED;

  const poll = await pollRepo.findOne({ pollId });
  let pollChain = "";
  if (poll) {
    pollChain = poll.pollChain;
  }

  const tx = await axlQueryService.getTxWithHash(txHash);

  // Recursive function to search for vote message
  const findVoteMessage = (messages: any[]): any => {
    for (const msg of messages) {
      // Check BatchRequest messages
      if (msg['@type'] === '/axelar.auxiliary.v1beta1.BatchRequest' && Array.isArray(msg.messages)) {
        const found = findVoteMessage(msg.messages);
        if (found) return found;
      }
      
      // Check RefundMsgRequest with inner_message
      if (msg['@type'] === '/axelar.reward.v1beta1.RefundMsgRequest' && msg.inner_message) {
        if (msg.inner_message['@type'] === '/axelar.vote.v1beta1.VoteRequest') {
          return msg.inner_message;
        }
      }
      
      // Direct VoteRequest message
      if (msg['@type'] === '/axelar.vote.v1beta1.VoteRequest') {
        return msg;
      }
    }
    return null;
  };

  const messages = tx?.tx?.body?.messages || [];
  const voteMessage = findVoteMessage(messages);

  if (voteMessage && voteMessage.poll_id === pollId) {
    const voteEvents = voteMessage.vote?.events || [];
    // Check if there are any events with valid status
    if (voteEvents.length > 0) {
      voteState = PollVoteType.YES;
    } else {
      voteState = PollVoteType.NO;
    }
  }

  const customId = genPollVoteCustomId(pollId, voter_address);
  await pollVoteRepo.upsertOne(
    { customId },
    {
      pollChain,
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
};
