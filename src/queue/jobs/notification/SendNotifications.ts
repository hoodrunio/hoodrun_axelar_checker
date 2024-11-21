import { AppDb } from "@/database/database";
import { NotificationType, INotification as INotificationInterface } from "@/database/models/notification/notification.interface";
import { logger } from "@/utils/logger";
import { TGBot } from "@/bot/tg/TGBot";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { SpecificError } from "@/utils/errors/error";
import { Queue, Job } from 'bull';

interface INotification extends INotificationInterface {
  retryCount?: number;
  failed?: boolean;
  lastError?: string;
}

const SEND_NOTIFICATIONS_JOB = "sendNotificationsJob";

class SendNotificationsQueueManager {
  private static instance: SendNotificationsQueueManager;
  private queue: Queue<any> | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): SendNotificationsQueueManager {
    if (!SendNotificationsQueueManager.instance) {
      SendNotificationsQueueManager.instance = new SendNotificationsQueueManager();
    }
    return SendNotificationsQueueManager.instance;
  }

  public async getQueue(): Promise<Queue<any>> {
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

        this.queue = AppQueueFactory.createQueue(SEND_NOTIFICATIONS_JOB);

        this.queue.process(async (job) => {
          try {
            const maxRetries = 3;
            let retries = 0;

            const processNotifications = async () => {
              const processWithRetry = async () => {
                try {
                  const { notificationRepo } = new AppDb();
                  const notSentNotifications = await notificationRepo.findAll({
                    sent: false,
                    sort: { createdAt: 1 },
                  });

                  if (!notSentNotifications || notSentNotifications.length === 0) {
                    logger.info("No unsent notifications found");
                    return;
                  }

                  logger.info(`Found ${notSentNotifications.length} unsent notifications`);

                  const tgBot = await TGBot.getInstance();

                  const results = await Promise.allSettled(
                    notSentNotifications.map(async (notification: INotification) => {
                      try {
                        logger.info(`Attempting to send notification ${notification.notification_id}`);
                        const result = await tgBot.sendNotification(notification);
                        if (result.sentSuccess) {
                          await notificationRepo.updateOne(
                            { notification_id: notification.notification_id },
                            { sent: true }
                          );
                          logger.info(`Successfully sent notification ${notification.notification_id}`);
                        }
                        return { notification_id: notification.notification_id, error: null };
                      } catch (error) {
                        logger.error(`Error sending notification ${notification.notification_id}:`, error);
                        return { notification_id: notification.notification_id, error };
                      }
                    })
                  );

                  await reQueueFailedNotifications(results);

                } catch (error) {
                  logger.error("Error in processWithRetry:", error);
                  throw error;
                }
              };

              while (retries < maxRetries) {
                try {
                  await processWithRetry();
                  break;
                } catch (error) {
                  retries++;
                  if (retries === maxRetries) {
                    logger.error(`Failed to process notifications after ${maxRetries} attempts`);
                    throw error;
                  }
                  logger.warn(`Retry attempt ${retries}/${maxRetries}`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
              }
            };

            await processNotifications();
          } catch (error) {
            logger.error("Error in notification processing:", error);
            throw error;
          }
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
        logger.info('SendNotifications queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing SendNotifications queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

const queueManager = SendNotificationsQueueManager.getInstance();

export const initSendNotificationsQueue = async () => {
  await queueManager.getQueue();
};

export const addSendNotificationsJob = async () => {
  const queue = await queueManager.getQueue();
  try {
    await appJobProducer.addJob(
      SEND_NOTIFICATIONS_JOB,
      {},
      { repeat: { every: xSeconds(10) } }
    );
    logger.info("Send notifications job added successfully");
  } catch (error) {
    logger.error("Failed to add send notifications job:", error);
  }
};

async function reQueueFailedNotifications(failedNotifications: Array<{ reason?: any; value?: { notification_id: string, error: any } }>) {
  const { notificationRepo } = new AppDb();

  for (const result of failedNotifications) {
    if (result.reason || (result.value && result.value.error)) {
      const notificationId = result.value?.notification_id;
      if (!notificationId) continue;

      const notification = await notificationRepo.findOne({ notification_id: notificationId });
      if (!notification) continue;

      const retryCount = (notification.retryCount || 0) + 1;
      const error = result.reason || result.value?.error;

      await notificationRepo.updateOne(
        { notification_id: notificationId },
        {
          retryCount,
          failed: retryCount >= 3,
          lastError: error?.message || String(error)
        }
      );
    }
  }
}