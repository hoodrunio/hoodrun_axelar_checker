import {
  NewWsPollAndVoteDto,
  NewWsPollDataTypeEnum,
} from "@/queue/jobs/poll/dto/NewWsPollDtos";
import { handleOnNewPollVote } from "@/queue/jobs/poll/handler/HandleNewPollVote";
import { handleOnNewPoll } from "@/queue/jobs/poll/handler/HandleOnNewPoll";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { logger } from "@utils/logger";
import { Queue, Job } from 'bull';

const NEW_WS_ALL_POLL_DATA_JOB = "NewWsAllPollDataJob";

class NewWsAllPollDataQueueManager {
  private static instance: NewWsAllPollDataQueueManager;
  private queue: Queue<NewWsPollAndVoteDto> | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): NewWsAllPollDataQueueManager {
    if (!NewWsAllPollDataQueueManager.instance) {
      NewWsAllPollDataQueueManager.instance = new NewWsAllPollDataQueueManager();
    }
    return NewWsAllPollDataQueueManager.instance;
  }

  public async getQueue(): Promise<Queue<NewWsPollAndVoteDto>> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.queue) {
      await this.initQueue();
    }
    return this.queue!;
  }

  private async initQueue(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (this.isInitialized && this.queue) {
          try {
            await this.queue.getJobCounts();
            return;
          } catch (error) {
            logger.error('Queue check failed, reinitializing...', error);
            this.isInitialized = false;
            this.queue = null;
          }
        }

        this.queue = AppQueueFactory.createQueue<NewWsPollAndVoteDto>(
          NEW_WS_ALL_POLL_DATA_JOB,
          true
        );

        this.queue.process(async (job: Job<NewWsPollAndVoteDto>) => {
          const { type, data } = job.data;
          logger.info(`Processing ${type} job`, { 
            jobId: job.id,
            pollId: type === NewWsPollDataTypeEnum.NEW_POLL ? data.pollId : data.customId,
            type 
          });

          try {
            if (type === NewWsPollDataTypeEnum.NEW_POLL) {
              await handleOnNewPoll(data);
              logger.info(`Successfully processed NEW_POLL`, { 
                jobId: job.id, 
                pollId: data.pollId,
                chain: data.pollChain 
              });
            }

            if (type === NewWsPollDataTypeEnum.NEW_POLL_VOTE) {
              await handleOnNewPollVote(data);
              logger.info(`Successfully processed NEW_POLL_VOTE`, { 
                jobId: job.id, 
                pollId: data.pollId,
                voter: data.voter_address 
              });
            }
          } catch (error) {
            logger.error(`Failed to process ${type} job`, {
              jobId: job.id,
              pollId: type === NewWsPollDataTypeEnum.NEW_POLL ? data.pollId : data.customId,
              error: (error as Error).message,
              stack: (error as Error).stack
            });
            // Re-throw the error to trigger Bull's retry mechanism
            throw error;
          }
        });

        // Add error handler
        this.queue.on('error', (error: Error) => {
          logger.error('Queue error:', { error: error.message, stack: error.stack });
        });

        // Add stalled handler
        this.queue.on('stalled', (job: Job<NewWsPollAndVoteDto>) => {
          logger.warn('Job stalled:', { 
            jobId: job.id,
            type: job.data.type,
            pollId: job.data.type === NewWsPollDataTypeEnum.NEW_POLL ? 
              job.data.data.pollId : 
              job.data.data.customId
          });
        });

        // Add failed handler
        this.queue.on('failed', (job: Job<NewWsPollAndVoteDto>, error: Error) => {
          logger.error('Job failed:', { 
            jobId: job.id,
            type: job.data.type,
            pollId: job.data.type === NewWsPollDataTypeEnum.NEW_POLL ? 
              job.data.data.pollId : 
              job.data.data.customId,
            error: error.message,
            stack: error.stack
          });
        });

        this.isInitialized = true;
        logger.info('NewWsAllPollData queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing NewWsAllPollData queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = NewWsAllPollDataQueueManager.getInstance();

export const initNewWsAllPollDataQueue = async () => {
  await queueManager.getQueue();
};

export const addNewWsAllPollDataJob = async (data: NewWsPollAndVoteDto) => {
  const queue = await queueManager.getQueue();
  appJobProducer.addJob(NEW_WS_ALL_POLL_DATA_JOB, data);
};
