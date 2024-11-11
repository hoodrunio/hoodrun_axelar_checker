import { Queue } from 'bull';
import { AmplifierEventDecoder } from '@/services/amplifier/AmplifierEventDecoder';
import { AmplifierEventType } from '@/types/amplifier';
import { AppDb } from '@/database/database';
import { logger } from '@/utils/logger';
import { AmplifierVerifierService } from '@/services/amplifier/AmplifierVerifierService';
import { AmplifierPollState } from '@/database/models/amplifier/interfaces';
import { AmplifierVoteType } from '@/types/amplifier';

export class AmplifierEventHandler {
  public decoder: AmplifierEventDecoder;
  private db: AppDb;
  private voteCheckQueue: Queue;
  private verifierService: AmplifierVerifierService;

  constructor(voteCheckQueue: Queue) {
    this.decoder = new AmplifierEventDecoder();
    this.db = new AppDb();
    this.voteCheckQueue = voteCheckQueue;
    this.verifierService = AmplifierVerifierService.getInstance();
  }

  public async handleEvent(event: any) {
    try {
      switch(event.type) {
        case AmplifierEventType.POLL_STARTED:
          await this.handlePollStarted(event);
          break;
        // case AmplifierEventType.SIGNING_STARTED:
        //   await this.handleSigningStarted(event);
        //   break;
      }
    } catch (error) {
      logger.error('Error handling amplifier event:', error);
      throw error;
    }
  }

  private async handlePollStarted(event: any) {
    const decodedAttributes = this.decoder.decodePollAttributes(event.attributes);
    
    if (!this.verifierService.isConfigured()) {
      logger.warn('Verifier address not configured, skipping poll event');
      return;
    }

    const verifierAddress = this.verifierService.getVerifierAddress();
    
    await this.db.amplifierPollRepo.upsertOne(
      { pollId: decodedAttributes.pollId },
      {
        ...decodedAttributes,
        pollState: AmplifierPollState.ACTIVE
      }
    );

    await this.db.amplifierVoteRepo.create({
      customId: `${decodedAttributes.pollId}_${verifierAddress}`,
      pollId: decodedAttributes.pollId,
      voterAddress: verifierAddress,
      vote: AmplifierVoteType.UNSUBMITTED,
      checkedForNotification: false
    });

    await this.voteCheckQueue.add(
      { pollId: decodedAttributes.pollId },
      { delay: 5000 }
    );
  }
}