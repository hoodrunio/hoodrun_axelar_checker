import BaseRepository from '@/repositories/base.repository';
import { IAmplifierPoll, IAmplifierPollDocument } from '@/database/models/amplifier/poll.interface';
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
    vote: 'Yes' | 'No' | 'Unsubmitted'
  ): Promise<void> {
    const poll = await this.findByPollId(pollId);
    if (!poll) return;

    const voteIndex = poll.votes.findIndex(v => v.voter === voter);
    if (voteIndex === -1) {
      poll.votes.push({ voter, vote, votedAt: Date.now() });
    } else {
      poll.votes[voteIndex] = { ...poll.votes[voteIndex], vote, votedAt: Date.now() };
    }

    await this.updateOne({ pollId }, { votes: poll.votes });
  }

  async updatePollStatus(
    pollId: string, 
    status: 'Pending' | 'Completed' | 'Failed'
  ): Promise<void> {
    await this.updateOne({ pollId }, { status });
  }
} 