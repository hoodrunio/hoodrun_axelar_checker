import { TGBot } from "@/bot/tg/TGBot";
import { initWsMessageResultHandlerQueue } from "@/queue/jobs/WsMessageResultHandler";
import {
  initSendNotificationsQueue,
  addSendNotificationsJob,
} from "@/queue/jobs/notification/SendNotifications";
import { initNewWsAllPollDataQueue } from "@/queue/jobs/poll/NewWsAllPollDataJob";
import {
  initPollVoteNotificationQueue,
  addPollVoteNotificationJob,
} from "@/queue/jobs/poll/notification/PollVoteNotificationJob";
import {
  addRpcEndpointHealthcheckerJob,
  initRpcEndpointHealthcheckerQueue,
} from "@/queue/jobs/rpc_endpoint_healthy/RpcEndpointHealthcheckerJob";
import {
  initValAllInfoCheckerQueue,
  addValAllInfoCheckerJob,
} from "@/queue/jobs/validators/ValAllInfoCheckerJob";
import {
  initValsUptimeCheckerQueue,
  addValUptimeCheckerJob,
} from "@/queue/jobs/validators/ValUptimeCheckerJob";
import { AxelarQueryService } from "@/services/rest/AxelarQueryService";
import { AxelarWsClient } from "@/ws/client/AxelarWsClient";
import { connectDb } from "@database/index";
import http from 'http';
import { logger } from '@/utils/logger';
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import mongoose from 'mongoose';
import {
  initBroadcasterBalanceCheckerQueue,
  addBroadcasterBalanceCheckerJob,
} from "@/queue/jobs/BroadcasterBalanceCheckerJob";
import { 
  initAmplifierTrackingQueues,
  AMPLIFIER_POLL_TRACKING,
  AMPLIFIER_SIGNATURE_TRACKING
} from '@/queue/jobs/amplifier/AmplifierTrackingJobs';
import { AppDb } from "@database/database";
import { testRedisConnection } from "@/queue/queue/AppQueueFactory";
import { AmplifierQueueManager } from '@/queue/queue/AmplifierQueueManager';

export default class App {
  axelarQueryService: AxelarQueryService;
  env: string;
  private tgBot: TGBot | null;
  private appDb: AppDb;
  private healthyQueues: string[];
  private jobs: { name: string; job: () => Promise<void> | void }[];

  constructor() {
    this.env = process.env.NODE_ENV ?? "development";
    this.axelarQueryService = new AxelarQueryService();
    this.appDb = new AppDb();
    this.tgBot = null; // Initialize TGBot as null
    this.healthyQueues = ['sendNotifications', 'pollVoteNotification', 'rpcEndpointHealthchecker'];
    this.jobs = [];
  }

  async initTgBot() {
    this.tgBot = await TGBot.getInstance();
  }

  async initalizeApplication(restart: boolean = false) {
    const maxRetries = 5;
    let retries = 0;

    const initializeWithRetry = async () => {
      try {
        logger.info("Testing Redis connection...");
        const redisConnected = await testRedisConnection();
        if (!redisConnected) {
          throw new Error("Redis connection failed.");
        }
        logger.info("Redis connection successful.");

        await this.initDbConn();
        await this.initAxelarWS();
        await this.initTgBot(); // Start TGBot
        await this.initJobsAndQueues();
        this.initHealthCheck();
        logger.info("Application started successfully");
      } catch (error) {
        logger.error(`Application startup error: ${error}`);
        retries++;
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          logger.info(`Retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
          setTimeout(initializeWithRetry, delay);
        } else {
          logger.error("Maximum retry attempts reached. Application failed to start.");
          process.exit(1);
        }
      }
    };

    if (restart) {
      logger.info("Closing all queues...")
      await AppQueueFactory.removeAllQueueListeners();
      await AppQueueFactory.closeAll();
      process.exit(1)
    }
    await initializeWithRetry();
  }
  private async initAxelarWS() {
    const wsClient = new AxelarWsClient();
    wsClient.on('disconnect', () => {
      logger.warn('WebSocket disconnected. Attempting to reconnect...');
      setTimeout(() => this.initAxelarWS(), 5000);
    });
  }

  private async initDbConn() {
    const maxRetries = 5;
    let retries = 0;

    const connectWithRetry = async () => {
      try {
        await connectDb(this.env);
        logger.info("Successfully connected to the database");
      } catch (error) {
        retries++;
        logger.error(`Failed to connect to the database (attempt ${retries}/${maxRetries}):`, error);
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff
          setTimeout(connectWithRetry, delay);
        } else {
          logger.error("Max retries reached. Unable to connect to the database.");
          process.exit(1);
        }
      }
    };

    await connectWithRetry();
  }

  private async initJobsAndQueues() {
    // Init queues before jobs
    await this.initQueue();
    // ------------------------------ //
    await this.initJobs();
  }

  private async initQueue() {
    try {
      // Initialize all queues in parallel for better performance
      await Promise.all([
        initValAllInfoCheckerQueue(),
        initValsUptimeCheckerQueue(),
        initPollVoteNotificationQueue(),
        initSendNotificationsQueue(),
        initWsMessageResultHandlerQueue(),
        initNewWsAllPollDataQueue(),
        initRpcEndpointHealthcheckerQueue(),
        initBroadcasterBalanceCheckerQueue(),
        initAmplifierTrackingQueues()
      ]);
      
      logger.info('All queues initialized successfully');
    } catch (error) {
      logger.error('Error initializing queues:', error);
      throw error;
    }
  }

  private async initJobs() {
    try {
      // Initialize AmplifierQueueManager first
      const queueManager = await AmplifierQueueManager.getInstance();
      logger.info('AmplifierQueueManager initialized successfully');
      
      const jobs = [
        { name: 'sendNotifications', job: addSendNotificationsJob },
        { name: 'valAllInfoChecker', job: addValAllInfoCheckerJob },
        { name: 'valUptimeChecker', job: addValUptimeCheckerJob },
        { name: 'pollVoteNotification', job: addPollVoteNotificationJob },
        { name: 'rpcEndpointHealthchecker', job: addRpcEndpointHealthcheckerJob },
        { name: 'broadcasterBalanceChecker', job: addBroadcasterBalanceCheckerJob },
        { name: AMPLIFIER_POLL_TRACKING, job: () => {} },
        { name: AMPLIFIER_SIGNATURE_TRACKING, job: () => {} }
      ];

      this.jobs = jobs;

      // Initialize all queues first
      const queues = await Promise.all(
        jobs.map(async ({ name }) => {
          try {
            const queue = await AppQueueFactory.getQueue(name);
            // Clear any existing jobs to start fresh
            await queue.empty();
            return { name, queue, error: null };
          } catch (error) {
            return { name, queue: null, error };
          }
        })
      );

      // Log queue initialization results
      queues.forEach(({ name, error }) => {
        if (error) {
          logger.error(`Failed to initialize queue ${name}:`, error);
        } else {
          logger.info(`Successfully initialized queue ${name}`);
        }
      });

      // Initialize each job
      for (const { name, job } of jobs) {
        try {
          if (typeof job === 'function') {
            await job();
            logger.info(`Successfully initialized job: ${name}`);
            
            if (this.healthyQueues.includes(name)) {
              const queue = await AppQueueFactory.getQueue(name);
              // Remove any existing repeatable jobs
              const existingJobs = await queue.getRepeatableJobs();
              await Promise.all(
                existingJobs.map(job => queue.removeRepeatableByKey(job.key))
              );
              
              // Add new repeatable job
              await queue.add(
                `${name}_repeatable`,
                {},
                {
                  repeat: {
                    every: 10000, // 10 seconds
                    limit: 1000000 // Prevent infinite growth
                  },
                  removeOnComplete: true,
                  attempts: 3,
                  backoff: {
                    type: 'exponential',
                    delay: 1000
                  }
                }
              );
              logger.info(`Added repeatable job for ${name}`);
            }
          }
        } catch (error) {
          logger.error(`Failed to initialize job ${name}:`, error);
          await this.retryJobInitialization(name, job);
        }
      }

      logger.info('All jobs initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize jobs:', error);
      throw error;
    }
  }

  private async retryJobInitialization(name: string, job: () => Promise<void> | void, attempt = 1) {
    const maxAttempts = 5;
    const delay = Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30 second delay

    if (attempt <= maxAttempts) {
      logger.info(`Retrying job ${name} initialization. Attempt ${attempt} of ${maxAttempts}`);
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        await job();
        logger.info(`Successfully initialized job ${name} on retry ${attempt}`);
      } catch (error) {
        logger.error(`Retry ${attempt} failed for job ${name}:`, error);
        await this.retryJobInitialization(name, job, attempt + 1);
      }
    } else {
      logger.error(`Failed to initialize job ${name} after ${maxAttempts} attempts`);
    }
  }

  private async checkQueuesStatus() {
    try {
      const queueNames = Object.keys(AppQueueFactory['queues']);
      const queuePromises = queueNames.map(name => AppQueueFactory.getQueue(name));
      const queues = await Promise.all(queuePromises);
      let hasFailedQueue = false;
      
      for (const queue of queues) {
        try {
          const [jobCounts, repeatableJobs] = await Promise.all([
            queue.getJobCounts(),
            this.healthyQueues.includes(queue.name) ? queue.getRepeatableJobs() : Promise.resolve([])
          ]);

          // Log detailed queue status
          logger.info(`Queue ${queue.name} status:`, {
            ...jobCounts,
            repeatableJobs: repeatableJobs.length,
            isHealthyQueue: this.healthyQueues.includes(queue.name)
          });

          if (this.healthyQueues.includes(queue.name)) {
            if (repeatableJobs.length === 0) {
              logger.warn(`Queue ${queue.name} has no repeatable jobs. Reinitializing...`);
              const job = this.jobs.find(j => j.name === queue.name)?.job;
              if (job) {
                await job();
                logger.info(`Reinitialized job for queue ${queue.name}`);
              }
            }

            // Check if jobs are being processed
            const activeJobs = await queue.getActive();
            if (activeJobs.length > 0) {
              const stalledJobs = activeJobs.filter(
                job => Date.now() - job.timestamp > 5 * 60 * 1000 // 5 minutes
              );
              
              if (stalledJobs.length > 0) {
                logger.warn(`Found ${stalledJobs.length} stalled jobs in queue ${queue.name}`);
                await Promise.all(
                  stalledJobs.map(job => job.moveToFailed(new Error('Job stalled')))
                );
                hasFailedQueue = true;
              }
            }
          }

          // Clean up completed and failed jobs
          if (jobCounts.completed > 1000) {
            await queue.clean(24 * 3600 * 1000, 'completed'); // Keep last 24 hours
          }
          if (jobCounts.failed > 0) {
            await queue.clean(24 * 3600 * 1000, 'failed');
          }
        } catch (error) {
          logger.error(`Error checking queue ${queue.name}:`, error);
          hasFailedQueue = true;
        }
      }
      
      return !hasFailedQueue;
    } catch (error) {
      logger.error(`Queue status check failed:`, error);
      return false;
    }
  }

  private async initHealthCheck() {
    // Check services health every 30 seconds
    setInterval(async () => {
      try {
        const redisStatus = await AppQueueFactory.checkRedisConnection();
        const dbStatus = await this.checkDatabaseConnection();
        const queuesStatus = await this.checkQueuesStatus();

        if (!redisStatus || !dbStatus) {
          logger.warn("Service connection issues detected, attempting recovery...");
          if (!dbStatus) {
            logger.warn('Database connection unhealthy, attempting to reconnect...');
            await this.connectWithRetry();
          }
          if (!redisStatus) {
            logger.warn('Redis connection unhealthy, attempting to recover queues...');
            await this.initQueue();
          }
        }

        if (!queuesStatus) {
          logger.warn("Queue health check failed, attempting recovery...");
          await this.initQueue();
        }
      } catch (error) {
        logger.error(`Health check failed:`, error);
      }
    }, 30000); // 30 seconds

    // Listen for system resume events (OS specific)
    if (process.platform === 'darwin') { // macOS
      process.on('SIGCONT', async () => {
        logger.info('System resumed from sleep, checking connections...');
        await this.checkAndRecoverConnections();
      });
    }
  }

  private async checkAndRecoverConnections() {
    try {
      const redisStatus = await AppQueueFactory.checkRedisConnection();
      const dbStatus = await this.checkDatabaseConnection();
      const queuesStatus = await this.checkQueuesStatus();

      if (!redisStatus || !dbStatus || !queuesStatus) {
        logger.info('Recovering connections after system resume...');
        await this.initalizeApplication(true);
      }
    } catch (error) {
      logger.error('Error recovering connections after system resume:', error);
    }
  }

  private async connectWithRetry(attempt = 1, maxAttempts = 5): Promise<boolean> {
    try {
      await this.initDbConn(); // Using existing initDbConn instead of appDb.connect
      logger.info('Successfully connected to database');
      return true;
    } catch (error) {
      logger.error(`Database connection attempt ${attempt} failed:`, error);
      
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 1000, 5000);
        logger.info(`Retrying connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connectWithRetry(attempt + 1, maxAttempts);
      } else {
        logger.error(`Failed to connect to database after ${maxAttempts} attempts`);
        return false;
      }
    }
  }

  private async checkDatabaseConnection() {
    try {
      if(mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.error(`Database connection check failed: ${error}`);
      return false;
    }
  }

  public async shutdown() {
    logger.info('Shutting down application...');
    // Close database connection
    await this.appDb.close();
    // Stop bot
    if (this.tgBot) {
      await this.tgBot.stop();
    }
    logger.info('Application shut down successfully');
  }
}

const app = new App();

process.on('unhandledRejection', (reason, promise) => {
  console.log(reason, promise)
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});