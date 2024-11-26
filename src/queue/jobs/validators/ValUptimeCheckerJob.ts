import { AppDb } from "@database/database";
import {
  NotificationEvent,
  NotificationType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";
import { ITelegramUser } from "@database/models/telegram_user/telegram_user.interface";
import { logger } from "@utils/logger";

import appConfig from "@config/index";
import { createUptimeCondition } from "@/notification/condition/uptime";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Queue, Job } from 'bull';

export const VALIDATOR_UPTIME_CHECKER = "valUptimeChecker";

class ValsUptimeCheckerQueueManager {
  private static instance: ValsUptimeCheckerQueueManager;
  private queue: Queue | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ValsUptimeCheckerQueueManager {
    if (!ValsUptimeCheckerQueueManager.instance) {
      ValsUptimeCheckerQueueManager.instance = new ValsUptimeCheckerQueueManager();
    }
    return ValsUptimeCheckerQueueManager.instance;
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

        this.queue = AppQueueFactory.createQueue(VALIDATOR_UPTIME_CHECKER);

        // Set a higher concurrency for better performance
        this.queue.process(4, async (job) => {
          const db = new AppDb();
          const activeValidators = [];

          try {
            const envValidator = await db.validatorRepository.findOne({
              voter_address: appConfig.axelarVoterAddress,
              is_active: true,
            });

            if (envValidator) {
              activeValidators.push(envValidator);
              logger.info(`Processing uptime for validator: ${envValidator.description.moniker}`);
            } else {
              logger.warn('No active validator found for the configured voter address');
              return Promise.resolve();
            }

            const promises = activeValidators.map(async (validator) => {
              const {
                uptime,
                operator_address,
                description: { moniker },
              } = validator;

              const event = NotificationEvent.UPTIME;
              const { value: currentUptimeCondition, threshold: closestThreshold } =
                createUptimeCondition({
                  operatorAddress: operator_address,
                  uptime,
                });

              // Log the current uptime and threshold
              logger.info(`Validator ${moniker} current uptime: ${uptime}, threshold: ${closestThreshold}`);

              // Get all telegram users
              const tempAllTgUsers = await db.telegramUserRepo.findAll({});

              const tgUserProcessPromisses = tempAllTgUsers.map(
                async (tgUser) =>
                  await processTgUser({
                    moniker,
                    tgUser,
                    operator_address,
                    uptime,
                    closestThreshold,
                    currentUptimeCondition,
                    event,
                  })
              );

              try {
                await Promise.all(tgUserProcessPromisses);
                return Promise.resolve();
              } catch (error) {
                logger.error("Error in uptime notification creation job", error);
              }
            });

            await Promise.all(promises);
          } catch (error) {
            logger.error("Error in uptime checker job", error);
            throw error; // Let Bull handle the retry
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

        // Add completed handler
        this.queue.on('completed', (job: Job) => {
          logger.debug('Uptime check completed:', job.id);
        });

        this.isInitialized = true;
        logger.info('ValsUptimeChecker queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing ValsUptimeChecker queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = ValsUptimeCheckerQueueManager.getInstance();

export const initValsUptimeCheckerQueue = async () => {
  await queueManager.getQueue();
};

export const addValUptimeCheckerJob = () => {
  appJobProducer.addJob(
    VALIDATOR_UPTIME_CHECKER,
    {},
    {
      repeat: { every: xSeconds(10) },
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 6000
      }
    }
  );
  logger.info('Uptime checker job scheduled to run every 1 minutes');
};

interface ProcessTgUserParams {
  tgUser: ITelegramUser;
  moniker: string;
  operator_address: string;
  uptime: number | { toString(): string };
  closestThreshold: number;
  currentUptimeCondition: string;
  event: NotificationEvent;
}

async function processTgUser(params: ProcessTgUserParams) {
  const {
    event,
    moniker,
    tgUser,
    operator_address,
    uptime,
    closestThreshold,
    currentUptimeCondition,
  } = params;

  const db = new AppDb();
  const tgChatId = tgUser.chat_id;
  const notificationId = `uptime-${operator_address}-${tgChatId}`;
  
  // Convert uptime to proper decimal value
  const uptimeValue = typeof uptime === 'object' && 'toString' in uptime ? 
    parseFloat(uptime.toString()) : 
    Number(uptime);

  const uptimeNotificationData: UptimeNotificationDataType = {
    operatorAddress: operator_address,
    currentUptime: uptimeValue,
    moniker,
    threshold: closestThreshold,
  };

  const earlierCondition = await db.notificationRepo.findOne({
    event,
    condition: currentUptimeCondition,
  });
  const isNewCondition = !earlierCondition;

  // Always notify if it's a new condition or if the threshold has changed
  if (isNewCondition || (earlierCondition?.data as UptimeNotificationDataType)?.threshold !== closestThreshold) {
    await db.notificationRepo.upsertOne(
      { notification_id: notificationId },
      {
        event,
        data: uptimeNotificationData,
        condition: currentUptimeCondition,
        recipient: tgChatId.toString(),
        type: NotificationType.TELEGRAM,
        sent: false,
      }
    );

    // Log the threshold transition for monitoring
    logger.info(`Uptime notification created for ${moniker}: ${uptimeValue}% (Threshold: ${closestThreshold})`);
  }
}
