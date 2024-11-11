import BaseRepository from '@repositories/base.repository';
import { AmplifierPollModel } from '@/database/models/amplifier/amplifier_poll.model';
import { IAmplifierPoll } from '@/database/models/amplifier/interfaces';
import { AmplifierPollState } from '@/database/models/amplifier/interfaces';
import { Document, Model } from 'mongoose';

// Document tipi tanımı
export interface AmplifierPollDocument extends Document, IAmplifierPoll {}

export class AmplifierPollRepository extends BaseRepository<IAmplifierPoll, AmplifierPollDocument> {
  constructor() {
    // Model'i AmplifierPollDocument tipine cast ediyoruz
    super(AmplifierPollModel as Model<AmplifierPollDocument>);
  }

  async findActivePollsByChain(chain: string) {
    return this.find({
      sourceChain: chain,
      pollState: { $ne: AmplifierPollState.COMPLETED }
    });
  }

  async findPendingVotes(pollId: string) {
    return this.findOne({
      pollId,
      'votes.status': 'pending'
    });
  }
}