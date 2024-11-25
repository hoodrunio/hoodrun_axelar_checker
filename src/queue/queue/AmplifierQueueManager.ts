import Bull from 'bull';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { PollTrackingJob } from '../jobs/amplifier/PollTrackingJob';
import { SignatureTrackingJob } from '../jobs/amplifier/SignatureTrackingJob';
import { logger } from '@/utils/logger';
import AppQueueFactory from './AppQueueFactory';
import { Logger } from 'winston';
import axios from 'axios';
import appConfig from '@/config';

export class AmplifierQueueManager {
  private readonly pollQueue: Bull.Queue;
  private readonly signatureQueue: Bull.Queue;
  private readonly logger: Logger;
  public static instance: AmplifierQueueManager | null = null;

  private constructor(
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

  public static async getInstance(): Promise<AmplifierQueueManager> {
    if (!AmplifierQueueManager.instance) {
      const db = new AppDb();
      const lcdEndpoint = appConfig.mainnetAxelarLCDRestBaseUrls[0];
      if (!lcdEndpoint) {
        throw new Error('No LCD endpoint configured for Axelar mainnet');
      }

      const axiosClient = axios.create({
        baseURL: lcdEndpoint,
        timeout: 10000,
      });
      const queryService = new AmplifierQueryService(axiosClient, lcdEndpoint);
      
      AmplifierQueueManager.instance = new AmplifierQueueManager(db, queryService);
    }
    return AmplifierQueueManager.instance;
  }

  private async initializeQueues(): Promise<void> {
    try {
      // Clear existing jobs on startup
      await this.pollQueue.empty();
      await this.signatureQueue.empty();

      const pollJob = new PollTrackingJob(this.db, this.queryService);
      const signatureJob = new SignatureTrackingJob(this.db, this.queryService);

      this.pollQueue.process(job => pollJob.process(job));
      this.signatureQueue.process(job => signatureJob.process(job));

      // Enhanced error handling and logging for poll queue
      this.pollQueue.on('error', error => {
        this.logger.error('Poll queue error:', error);
      });

      this.pollQueue.on('completed', job => {
        this.logger.info(`Poll tracking completed for poll ${job.data.pollId}`, {
          attempts: job.attemptsMade,
          duration: Date.now() - job.timestamp
        });
      });

      this.pollQueue.on('failed', (job, error) => {
        this.logger.error(`Poll tracking failed for poll ${job.data.pollId}:`, {
          error,
          attempts: job.attemptsMade
        });
      });

      this.pollQueue.on('stalled', job => {
        this.logger.warn(`Poll tracking job stalled for poll ${job.data.pollId}`, {
          jobId: job.id,
          attempts: job.attemptsMade
        });
      });

      // Enhanced error handling and logging for signature queue
      this.signatureQueue.on('error', error => {
        this.logger.error('Signature queue error:', error);
      });

      this.signatureQueue.on('completed', job => {
        this.logger.info(`Signature tracking completed for session ${job.data.sessionId}`, {
          attempts: job.attemptsMade,
          duration: Date.now() - job.timestamp
        });
      });

      this.signatureQueue.on('failed', (job, error) => {
        this.logger.error(`Signature tracking failed for session ${job.data.sessionId}:`, {
          error,
          attempts: job.attemptsMade
        });
      });

      this.signatureQueue.on('stalled', job => {
        this.logger.warn(`Signature tracking job stalled for session ${job.data.sessionId}`, {
          jobId: job.id,
          attempts: job.attemptsMade
        });
      });

      this.logger.info('Queue initialization completed successfully');
    } catch (error) {
      this.logger.error('Failed to initialize queues:', error);
      throw error;
    }
  }

  async addPollTrackingJob(pollId: string, currentHeight: number): Promise<void> {
    this.logger.info(`Adding poll tracking job for poll ${pollId}`, {
      currentHeight,
      timestamp: Date.now()
    });

    try {
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
            limit: 10
          },
          removeOnComplete: true,
          jobId: `poll_${pollId}_${Date.now()}` // Unique job ID for better tracking
        }
      );

      this.logger.info(`Successfully added poll tracking job for poll ${pollId}`);
    } catch (error) {
      this.logger.error(`Failed to add poll tracking job for poll ${pollId}:`, error);
      throw error;
    }
  }

  async addSignatureTrackingJob(sessionId: string, currentHeight: number): Promise<void> {
    this.logger.info(`Adding signature tracking job for session ${sessionId}`, {
      currentHeight,
      timestamp: Date.now()
    });

    try {
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
            limit: 10
          },
          removeOnComplete: true,
          jobId: `signature_${sessionId}_${Date.now()}` // Unique job ID for better tracking
        }
      );

      this.logger.info(`Successfully added signature tracking job for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to add signature tracking job for session ${sessionId}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pollQueue.close();
      await this.signatureQueue.close();
      this.logger.info('Queues closed successfully');
    } catch (error) {
      this.logger.error('Error closing queues:', error);
      throw error;
    }
  }
}