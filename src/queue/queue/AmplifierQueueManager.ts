import Bull from 'bull';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { PollTrackingJob } from '../jobs/amplifier/PollTrackingJob';
import { SignatureTrackingJob } from '../jobs/amplifier/SignatureTrackingJob';
import { logger } from '@/utils/logger';
import AppQueueFactory from './AppQueueFactory';
import { Logger } from 'winston';

export class AmplifierQueueManager {
  private readonly pollQueue: Bull.Queue;
  private readonly signatureQueue: Bull.Queue;
  private readonly logger: Logger;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.pollQueue = AppQueueFactory.createQueue('amplifier-poll-tracking');
    this.signatureQueue = AppQueueFactory.createQueue('amplifier-signature-tracking');
    this.logger = logger.child({
      name: AmplifierQueueManager.name
    });

    this.initializeQueues();
  }

  private initializeQueues(): void {
    const pollJob = new PollTrackingJob(this.db, this.queryService);
    const signatureJob = new SignatureTrackingJob(this.db, this.queryService);

    this.pollQueue.process(job => pollJob.process(job));
    this.signatureQueue.process(job => signatureJob.process(job));

    // Error handling
    this.pollQueue.on('error', error => {
      this.logger.error('Poll queue error:', error);
    });

    this.signatureQueue.on('error', error => {
      this.logger.error('Signature queue error:', error);
    });
  }

  async addPollTrackingJob(pollId: string, currentHeight: number): Promise<void> {
    await this.pollQueue.add(
      { pollId, currentHeight },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        repeat: {
          every: 10000, // Check every 10 seconds
          limit: 10 // Stop after 100 attempts or when poll is complete/expired
        },
        removeOnComplete: true
      }
    );
  }

  async addSignatureTrackingJob(sessionId: string, currentHeight: number): Promise<void> {
    await this.signatureQueue.add(
      { sessionId, currentHeight },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        repeat: {
          every: 10000, // Check every 10 seconds
          limit: 10 // Stop after 100 attempts or when session is complete/expired
        },
        removeOnComplete: true
      }
    );
  }

  async close(): Promise<void> {
    await this.pollQueue.close();
    await this.signatureQueue.close();
  }
}