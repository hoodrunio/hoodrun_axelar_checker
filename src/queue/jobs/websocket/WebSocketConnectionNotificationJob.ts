import { AppDb } from "@/database/database";
import { NotificationEvent, NotificationType } from "@/database/models/notification/notification.interface";
import { logger } from "@/utils/logger";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Queue, Job } from "bull";
import { v4 as uuidv4 } from 'uuid';
import { addSendNotificationsJob } from "@/queue/jobs/notification/SendNotifications";

export const WEBSOCKET_CONNECTION_NOTIFICATION_JOB = "websocketConnectionNotificationJob";

interface WebSocketConnectionNotificationDataType {
  status: string;
  currentUrl: string;
  retryCount: number;
  lastError?: string;
  notification_id?: string;
  created_at?: Date;
}

class WebSocketConnectionNotificationQueueManager {
  private static instance: WebSocketConnectionNotificationQueueManager;
  private queue: Queue | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): WebSocketConnectionNotificationQueueManager {
    if (!WebSocketConnectionNotificationQueueManager.instance) {
      WebSocketConnectionNotificationQueueManager.instance = new WebSocketConnectionNotificationQueueManager();
    }
    return WebSocketConnectionNotificationQueueManager.instance;
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

        this.queue = AppQueueFactory.createQueue<WebSocketConnectionNotificationDataType>(
          WEBSOCKET_CONNECTION_NOTIFICATION_JOB
        );

        this.queue.process(async (job) => {
          try {
            const { notificationRepo, telegramUserRepo } = new AppDb();
            const { data } = job;

            logger.info(`Processing WebSocket connection notification:`, {
              status: data.status,
              currentUrl: data.currentUrl,
              retryCount: data.retryCount
            });

            // Get telegram users to notify
            const tgUsers = await telegramUserRepo.findAll();
            if (!tgUsers || tgUsers.length === 0) {
              logger.warn('No Telegram users found for notifications');
              return { success: false, reason: 'No telegram users found' };
            }

            // Create notifications for all users
            for (const user of tgUsers) {
              const notification = await notificationRepo.create({
                event: NotificationEvent.WEBSOCKET_CONNECTION_ISSUE,
                data: data,
                sent: false,
                notification_id: uuidv4(),
                created_at: new Date(),
                recipient: user.chat_id.toString(),
                type: NotificationType.TELEGRAM,
                condition: `ws_connection_${data.currentUrl}`
              });

              logger.info(`Created WebSocket notification for user ${user.chat_id}`, {
                notification_id: notification.notification_id
              });
            }

            // Add to notification queue
            await addSendNotificationsJob();
            logger.info(`WebSocket connection notifications queued successfully`);

            return { success: true };
          } catch (error) {
            logger.error('Error processing WebSocket connection notification:', error);
            throw error;
          }
        });

        this.queue.on('completed', (job) => {
          logger.info(`WebSocket connection notification job completed: ${job.id}`);
        });

        this.queue.on('failed', (job, error) => {
          logger.error(`WebSocket connection notification job failed: ${job.id}`, error);
          // Retry failed jobs with exponential backoff
          const attempts = job.attemptsMade;
          if (attempts < 5) { // Max 5 retries
            job.retry();
          }
        });

        this.isInitialized = true;
      } catch (error) {
        logger.error('Error initializing WebSocket connection notification queue:', error);
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  public async getQueue(): Promise<Queue> {
    await this.initQueue();
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }
    return this.queue;
  }
}

const queueManager = WebSocketConnectionNotificationQueueManager.getInstance();

export const initWebSocketConnectionNotificationQueue = async () => {
  await queueManager.getQueue();
};

export { WebSocketConnectionNotificationQueueManager };