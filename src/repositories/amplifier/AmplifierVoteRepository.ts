import BaseRepository from '@repositories/base.repository';
import { AmplifierVoteModel } from '@/database/models/amplifier/amplifier_vote.model';
import { IAmplifierVote } from '@/database/models/amplifier/interfaces';
import { AmplifierVoteType } from '@/types/amplifier';
import { Document, Model } from 'mongoose';

export interface AmplifierVoteDocument extends Document, IAmplifierVote {}

export interface VoteTxInfo {
  txHash: string;
  txHeight: number;
}

export class AmplifierVoteRepository extends BaseRepository<IAmplifierVote, AmplifierVoteDocument> {
  constructor() {
    super(AmplifierVoteModel as Model<AmplifierVoteDocument>);
  }

  async findUnsubmittedVotes(pollId: string) {
    return this.find({
      pollId,
      vote: AmplifierVoteType.UNSUBMITTED
    });
  }

  async updateVoteStatus(
    customId: string, 
    voteStatus: AmplifierVoteType,
    txInfo?: VoteTxInfo
  ): Promise<void> {
    const updateData: Partial<IAmplifierVote> = {
      vote: voteStatus
    };

    if (txInfo) {
      updateData.txHash = txInfo.txHash;
      updateData.txHeight = txInfo.txHeight;
    }

    await this.updateOne(
      { customId },
      updateData
    );
  }
}