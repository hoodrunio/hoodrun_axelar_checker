import { Job } from 'bull';
import { AmplifierVoteChecker } from '@/services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '@/services/amplifier/AmplifierVerifierService';
import { AppDb } from '@/database/database';
import { logger } from '@/utils/logger';
import { AmplifierVoteType } from '@/types/amplifier';
import { AmplifierPollState } from '@/database/models/amplifier/interfaces';
import { VoteTxInfo } from '@/repositories/amplifier/AmplifierVoteRepository';

interface ICheckVotesJobData {
  pollId: string;
  voterAddress: string;
}

export class CheckAmplifierVotesJob {
  private voteChecker: AmplifierVoteChecker;
  private db: AppDb;
  private verifierService: AmplifierVerifierService;

  constructor(voteChecker: AmplifierVoteChecker) {
    this.voteChecker = voteChecker;
    this.db = new AppDb();
    this.verifierService = AmplifierVerifierService.getInstance();
  }

  async process(job: Job<ICheckVotesJobData>) {
    const { pollId, voterAddress } = job.data;
    logger.info(`Processing vote check for poll ${pollId}`);

    try {
      if (!this.verifierService.isConfigured()) {
        throw new Error('Verifier address not configured');
      }

      const verifierAddress = this.verifierService.getVerifierAddress();
      const customId = `${pollId}_${verifierAddress}`;

      const vote = await this.db.amplifierVoteRepo.findOne({ customId });
      if (!vote) {
        logger.error(`Vote record not found for poll ${pollId}`);
        return;
      }

      const voteStatus = await this.voteChecker.checkVoteStatus(pollId);
      if (voteStatus !== vote.vote) {
        await this.updateVoteStatus(
          vote.customId, 
          voteStatus,
          pollId,
          voterAddress
        );
      }

      await this.updatePollStateIfNeeded(pollId);

    } catch (error) {
      logger.error(`Error processing vote check for poll ${pollId}:`, error);
      throw error;
    }
  }

  private async updateVoteStatus(
    customId: string,
    voteStatus: AmplifierVoteType,
    pollId: string,
    voterAddress: string
  ): Promise<void> {
    let txInfo: VoteTxInfo | undefined;
    
    if (voteStatus !== AmplifierVoteType.UNSUBMITTED) {
      const voteTxInfo = await this.voteChecker.getVoteTxInfo(
        voterAddress,
        pollId
      );
      if (voteTxInfo) {
        txInfo = {
          txHash: voteTxInfo.txHash,
          txHeight: voteTxInfo.txHeight
        };
      }
    }

    await this.db.amplifierVoteRepo.updateVoteStatus(
      customId,
      voteStatus,
      txInfo
    );
  }

  private async updatePollStateIfNeeded(pollId: string): Promise<void> {
    const poll = await this.db.amplifierPollRepo.findOne({ pollId });
    if (!poll) return;

    const vote = await this.db.amplifierVoteRepo.findOne({ 
      pollId,
      voterAddress: this.verifierService.getVerifierAddress()
    });

    if (vote?.vote !== AmplifierVoteType.UNSUBMITTED || Date.now() > poll.expiresAt) {
      await this.db.amplifierPollRepo.updateOne(
        { pollId },
        { pollState: AmplifierPollState.COMPLETED }
      );
    }
  }
}