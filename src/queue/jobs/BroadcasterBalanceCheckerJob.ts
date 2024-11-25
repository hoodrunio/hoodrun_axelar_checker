import appConfig from "@/config/index";
import { AppDb } from "@/database/database";
import { NotificationEvent, NotificationType } from "@/database/models/notification/notification.interface";
import { AxelarBalanceQueryService } from "@/services/rest/AxelarBalanceQueryService";
import { logger } from "@utils/logger";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Queue, Job } from 'bull';

const BROADCASTER_BALANCE_CHECKER = "broadcasterBalanceChecker";

class BroadcasterBalanceCheckerQueueManager {
  private static instance: BroadcasterBalanceCheckerQueueManager;
  private queue: Queue | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): BroadcasterBalanceCheckerQueueManager {
    if (!BroadcasterBalanceCheckerQueueManager.instance) {
      BroadcasterBalanceCheckerQueueManager.instance = new BroadcasterBalanceCheckerQueueManager();
    }
    return BroadcasterBalanceCheckerQueueManager.instance;
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

        this.queue = AppQueueFactory.createQueue(BROADCASTER_BALANCE_CHECKER);

        this.queue.process(async () => {
          const balanceService = new AxelarBalanceQueryService();
          const { notificationRepo, telegramUserRepo, validatorRepository } = new AppDb();

          try {
            const balance = await balanceService.getBroadcasterBalance();
            
            if (balance < appConfig.broadcasterBalanceThreshold) {
              const envValidator = await validatorRepository.findOne({
                voter_address: appConfig.axelarVoterAddress,
              });

              if (!envValidator) {
                logger.error("Validator not found for the given voter address");
                return;
              }

              const tgUsers = await telegramUserRepo.findAll();

              for (const user of tgUsers) {
                const notificationId = `broadcaster_balance_low_${Date.now()}`;
                
                await notificationRepo.create({
                  notification_id: notificationId,
                  event: NotificationEvent.BROADCASTER_BALANCE_LOW,
                  data: {
                    balance,
                    threshold: appConfig.broadcasterBalanceThreshold,
                    operatorAddress: envValidator.operator_address,
                    moniker: envValidator.description.moniker,
                  },
                  condition: `broadcaster_balance_${appConfig.axelarVoterAddress}`,
                  type: NotificationType.TELEGRAM,
                  recipient: user.chat_id.toString(),
                  sent: false,
                });
              }
            }
          } catch (error) {
            logger.error("Error in broadcaster balance checker job", error);
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
        logger.info('BroadcasterBalanceChecker queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing BroadcasterBalanceChecker queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = BroadcasterBalanceCheckerQueueManager.getInstance();

export const initBroadcasterBalanceCheckerQueue = async () => {
  await queueManager.getQueue();
};

export const addBroadcasterBalanceCheckerJob = () => {
  appJobProducer.addJob(
    BROADCASTER_BALANCE_CHECKER,
    {},
    { repeat: { every: xSeconds(appConfig.broadcasterBalanceCheckInterval) } }
  );
};
