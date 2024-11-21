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

          if (type == NewWsPollDataTypeEnum.NEW_POLL) {
            try {
              await handleOnNewPoll(data);
            } catch (error) {
              logger.error("Error in handleOnNewPoll", error);
            }
          }

          if (type == NewWsPollDataTypeEnum.NEW_POLL_VOTE) {
            try {
              await handleOnNewPollVote(data);
            } catch (error) {
              logger.error("Error in handleOnNewPollVote", error);
            }
          }

          return Promise.resolve();
        });

        // Add error handler
        this.queue.on('error', (error: Error) => {
          logger.error('Queue error:', error);
        });

        // Add stalled handler
        this.queue.on('stalled', (job: Job<NewWsPollAndVoteDto>) => {
          logger.warn('Job stalled:', job.id);
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
