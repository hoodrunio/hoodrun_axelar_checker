import { Queue, Job } from 'bull';
import { logger } from '@/utils/logger';
import { AppDb } from '@database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { PollTrackingJob } from './PollTrackingJob';
import { SignatureTrackingJob } from './SignatureTrackingJob';
import AppQueueFactory from '@/queue/queue/AppQueueFactory';
import appJobProducer from '@/queue/producer/AppJobProducer';
import axios from 'axios';
import appConfig from '@/config';

// Queue names
export const AMPLIFIER_POLL_TRACKING = 'amplifier-poll-tracking';
export const AMPLIFIER_SIGNATURE_TRACKING = 'amplifier-signature-tracking';

interface PollTrackingData {
  pollId: string;
  currentHeight: number;
}

interface SignatureTrackingData {
  sessionId: string;
  currentHeight: number;
}

class AmplifierTrackingQueueManager {
  private static instance: AmplifierTrackingQueueManager;
  private pollTrackingQueue: Queue<PollTrackingData> | null = null;
  private signatureTrackingQueue: Queue<SignatureTrackingData> | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): AmplifierTrackingQueueManager {
    if (!AmplifierTrackingQueueManager.instance) {
      AmplifierTrackingQueueManager.instance = new AmplifierTrackingQueueManager();
    }
    return AmplifierTrackingQueueManager.instance;
  }

  public async getQueues(): Promise<[Queue<PollTrackingData>, Queue<SignatureTrackingData>]> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.pollTrackingQueue || !this.signatureTrackingQueue) {
      await this.initQueues();
    }
    return [this.pollTrackingQueue!, this.signatureTrackingQueue!];
  }

  private async initQueues(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Clean up existing queues if they exist
        if (this.pollTrackingQueue) {
          await AppQueueFactory.removeQueue(AMPLIFIER_POLL_TRACKING);
          this.pollTrackingQueue = null;
        }
        
        if (this.signatureTrackingQueue) {
          await AppQueueFactory.removeQueue(AMPLIFIER_SIGNATURE_TRACKING);
          this.signatureTrackingQueue = null;
        }

        const db = new AppDb();
        
        // Initialize AmplifierQueryService with proper configuration
        const lcdEndpoint = appConfig.mainnetAxelarLCDRestBaseUrls[0];
        if (!lcdEndpoint) {
          throw new Error('No LCD endpoint configured for Axelar mainnet');
        }

        const axiosClient = axios.create({
          baseURL: lcdEndpoint,
          timeout: 10000,
        });
        const queryService = new AmplifierQueryService(axiosClient, lcdEndpoint);

        // Initialize Poll Tracking Queue
        this.pollTrackingQueue = await AppQueueFactory.getQueue<PollTrackingData>(AMPLIFIER_POLL_TRACKING);
        const pollJob = new PollTrackingJob(db, queryService);

        this.pollTrackingQueue.process(async (job) => {
          try {
            await pollJob.process(job);
          } catch (error) {
            logger.error('Error processing poll tracking job:', error);
            throw error;
          }
        });

        // Initialize Signature Tracking Queue
        this.signatureTrackingQueue = await AppQueueFactory.getQueue<SignatureTrackingData>(AMPLIFIER_SIGNATURE_TRACKING);
        const signatureJob = new SignatureTrackingJob(db, queryService);

        this.signatureTrackingQueue.process(async (job) => {
          try {
            await signatureJob.process(job);
          } catch (error) {
            logger.error('Error processing signature tracking job:', error);
            throw error;
          }
        });

        // Error handling for Poll Tracking Queue
        this.pollTrackingQueue.on('error', (error: Error) => {
          logger.error('Poll tracking queue error:', error);
        });

        this.pollTrackingQueue.on('stalled', (job: Job) => {
          logger.warn('Poll tracking job stalled:', job.id);
        });

        this.pollTrackingQueue.on('completed', (job) => {
          logger.info(`Poll tracking job completed for poll ${job.data.pollId}`);
        });

        // Error handling for Signature Tracking Queue
        this.signatureTrackingQueue.on('error', (error: Error) => {
          logger.error('Signature tracking queue error:', error);
        });

        this.signatureTrackingQueue.on('stalled', (job: Job) => {
          logger.warn('Signature tracking job stalled:', job.id);
        });

        this.signatureTrackingQueue.on('completed', (job) => {
          logger.info(`Signature tracking job completed for session ${job.data.sessionId}`);
        });

        this.isInitialized = true;
        logger.info('Amplifier tracking queues initialized successfully');
      } catch (error) {
        logger.error('Error initializing Amplifier tracking queues:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = AmplifierTrackingQueueManager.getInstance();

export const initAmplifierTrackingQueues = async () => {
  await queueManager.getQueues();
};

export const addPollTrackingJob = async (pollId: string, currentHeight: number) => {
  await appJobProducer.addJob(
    AMPLIFIER_POLL_TRACKING,
    { pollId, currentHeight },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: false,
      repeat: {
        every: 10000, // Check every 10 seconds
        limit: 10 // Stop after 10 attempts or when poll is complete/expired
      }
    }
  );
  logger.info(`Added repeatable poll tracking job for poll ${pollId} at height ${currentHeight}`);
};

export const addSignatureTrackingJob = async (sessionId: string, currentHeight: number) => {
  await appJobProducer.addJob(
    AMPLIFIER_SIGNATURE_TRACKING,
    { sessionId, currentHeight },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      repeat: {
        every: 10000, // Check every 10 seconds
        limit: 10 // Stop after 10 attempts or when session is complete/expired
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  );
  logger.info(`Added repeatable signature tracking job for session ${sessionId} at height ${currentHeight}`);
};