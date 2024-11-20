import BaseRepository from '@/repositories/base.repository';
import { IAmplifierPoll, IAmplifierPollDocument, PollStatus, VoteInfo, VoteType } from '@/database/models/amplifier/poll.interface';
import AmplifierPollDbModel from '@/database/models/amplifier/poll.model';

export class AmplifierPollRepository extends BaseRepository<IAmplifierPoll, IAmplifierPollDocument> {
  constructor() {
    super(AmplifierPollDbModel);
  }

  async findByPollId(pollId: string): Promise<IAmplifierPollDocument | null> {
    return this.findOne({ pollId });
  }

  async updateVoteStatus(
    pollId: string, 
    voter: string, 
    vote: VoteType
  ): Promise<void> {
    const poll = await this.findByPollId(pollId);
    if (!poll) return;

    const filteredVotes = poll.votes.filter(v => v.voter !== voter);
    const newVote = { voter, vote, votedAt: Date.now() };
    const updatedVotes = [...filteredVotes, newVote];

    await this.updateOne(
      { pollId }, 
      { votes: updatedVotes as VoteInfo[] }
    );
  }

  async updatePollStatus(
    pollId: string, 
    status: PollStatus
  ): Promise<void> {
    if (!Object.values(PollStatus).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    await this.updateOne({ pollId }, { status: status as PollStatus });
  }
} 