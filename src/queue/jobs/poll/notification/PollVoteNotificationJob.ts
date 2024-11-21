import appConfig from "@config/index";
import { AppDb } from "@database/database";
import {
  NotificationEvent,
  NotificationType,
  PollVoteNotificationDataType,
} from "@database/models/notification/notification.interface";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import { logger } from "@utils/logger";
import { createPollVoteCondition } from "@/notification/condition/pollVote";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Queue, Job } from 'bull';

const POLL_VOTE_NOTIFICATION_JOB = "pollVoteNotificationJob";

class PollVoteNotificationQueueManager {
  private static instance: PollVoteNotificationQueueManager;
  private queue: Queue | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): PollVoteNotificationQueueManager {
    if (!PollVoteNotificationQueueManager.instance) {
      PollVoteNotificationQueueManager.instance = new PollVoteNotificationQueueManager();
    }
    return PollVoteNotificationQueueManager.instance;
  }

  public async getQueue(): Promise<Queue> {
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

        // Clean up existing queue if it exists
        if (this.queue) {
          await AppQueueFactory.removeQueue(POLL_VOTE_NOTIFICATION_JOB);
          this.queue = null;
        }

        this.queue = await AppQueueFactory.getQueue(POLL_VOTE_NOTIFICATION_JOB);

        this.queue.process(async () => {
          try {
            const {
              pollVoteRepo,
              validatorRepository,
              telegramUserRepo,
              notificationRepo,
            } = new AppDb();

            const xHourAgoDate = new Date();
            xHourAgoDate.setHours(
              xHourAgoDate.getHours() - appConfig.maxLastXHourPollVoteNotification
            );

            const vote = PollVoteType.NO;
            const allNoPollVotes = await pollVoteRepo.findAll({
              vote,
              createdAt: { $gte: xHourAgoDate },
              checkedForNotification: false,
              sort: { createdAt: -1 },
            });

            const promisses = allNoPollVotes?.map(async (pollVote) => {
              const voterValidator = await validatorRepository.findOne({
                voter_address: pollVote.voter_address,
              });
              if (!voterValidator) return Promise.resolve();

              const tgUsers = await telegramUserRepo.findAll({});
              if (!tgUsers || tgUsers.length < 1) Promise.resolve();
              const pollVoteCondition = createPollVoteCondition(pollVote);
              for (const tgUser of tgUsers) {
                const chatId = tgUser.chat_id;
                const data: PollVoteNotificationDataType = {
                  chain: pollVote.pollChain,
                  pollId: pollVote.pollId,
                  vote: pollVote.vote,
                  operatorAddress: voterValidator.operator_address,
                  moniker: voterValidator.description.moniker,
                };
                const notificationId = `poll_vote-${pollVote.pollId}-${pollVote.voter_address}-${chatId}`;

                await notificationRepo.upsertOne(
                  { notification_id: notificationId },
                  {
                    data,
                    type: NotificationType.TELEGRAM,
                    notification_id: notificationId,
                    event: NotificationEvent.POOL_VOTE,
                    condition: pollVoteCondition,
                    recipient: chatId.toString(),
                    sent: false,
                  }
                );
              }

              await pollVoteRepo.updateOne(pollVote._id!, {
                checkedForNotification: true,
              });
            });

            await Promise.allSettled(promisses);
          } catch (error) {
            logger.error("Error in Poll Vote Notification Job", error);
            return Promise.resolve(error);
          }
          return Promise.resolve();
        });

        // Add error handler
        this.queue.on('error', (error: Error) => {
          logger.error('Queue error:', error);
        });

        // Add stalled handler
        this.queue.on('stalled', (job: Job) => {
          logger.warn('Job stalled:', job.id);
        });

        this.isInitialized = true;
        logger.info('PollVoteNotification queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing PollVoteNotification queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = PollVoteNotificationQueueManager.getInstance();

export const initPollVoteNotificationQueue = async () => {
  await queueManager.getQueue();
};

export const addPollVoteNotificationJob = () => {
  appJobProducer.addJob(
    POLL_VOTE_NOTIFICATION_JOB,
    {},
    {
      repeat: { every: xSeconds(20) },
    }
  );
};
