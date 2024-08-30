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
import { createClient } from 'redis';
import {
  initBroadcasterBalanceCheckerQueue,
  addBroadcasterBalanceCheckerJob,
} from "@/queue/jobs/BroadcasterBalanceCheckerJob";
import { AppDb } from "@database/database";
import { testRedisConnection } from "@/queue/queue/AppQueueFactory";

export default class App {
  axelarQueryService: AxelarQueryService;
  env: string;
  private tgBot: TGBot | null;
  private appDb: AppDb;

  constructor() {
    this.env = process.env.NODE_ENV ?? "development";
    this.axelarQueryService = new AxelarQueryService();
    this.appDb = new AppDb();
    this.tgBot = null; // Initialize TGBot as null
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
    await initValAllInfoCheckerQueue();
    await initValsUptimeCheckerQueue();
    await initPollVoteNotificationQueue();
    await initSendNotificationsQueue();
    await initWsMessageResultHandlerQueue();
    await initNewWsAllPollDataQueue();

    await initRpcEndpointHealthcheckerQueue();
    await initBroadcasterBalanceCheckerQueue();
  }

  private async initJobs() {
    const jobs = [
      { name: 'sendNotifications', job: addSendNotificationsJob },
      { name: 'valAllInfoChecker', job: addValAllInfoCheckerJob },
      { name: 'valUptimeChecker', job: addValUptimeCheckerJob },
      { name: 'pollVoteNotification', job: addPollVoteNotificationJob },
      { name: 'rpcEndpointHealthchecker', job: addRpcEndpointHealthcheckerJob },
      { name: 'broadcasterBalanceChecker', job: addBroadcasterBalanceCheckerJob },
    ];

    for (const { name, job } of jobs) {
      try {
        await job();
        logger.info(`Successfully initialized job: ${name}`);
        this.scheduleJobHealthCheck(name, job);
      } catch (error) {
        logger.error(`Failed to initialize job ${name}:`, error);
        setTimeout(() => this.initSingleJob(name, job), 5000);
      }
    }
  }

  private async initSingleJob(name: string, job: () => Promise<void> | void) {
    try {
      await job();
      logger.info(`Successfully initialized job: ${name}`);
      this.scheduleJobHealthCheck(name, job);
    } catch (error) {
      logger.error(`Failed to initialize job ${name}:`, error);
      setTimeout(() => this.initSingleJob(name, job), 5000);
    }
  }

  private scheduleJobHealthCheck(name: string, job: () => Promise<void> | void) {
    setInterval(async () => {
      try {
        const queue = AppQueueFactory.getQueue(name);
        const jobCounts = await queue.getJobCounts();
        if (jobCounts.active === 0 && jobCounts.waiting === 0 && jobCounts.delayed === 0) {
          console.log(name, jobCounts, true)
          logger.warn(`Job ${name} seems to be inactive. Restarting...`);
          await job();
        }
      } catch (error) {
        logger.error(`Error checking health of job ${name}:`, error);
      }
    }, 40 * 1000); // Check every 5 minutes
  }

  private initHealthCheck() {
    setInterval(async () => {
      try {
        const redisStatus = await AppQueueFactory.checkRedisConnection();
        const dbStatus = await this.checkDatabaseConnection();
        const queuesStatus = await this.checkQueuesStatus();

        if (!redisStatus || !dbStatus || !queuesStatus) {
          logger.error("Health check failed. Attempting to reinitialize application.");
          await this.initalizeApplication(true);
        } else {
          logger.info('Health check passed successfully')
        }
      } catch (error) {
        logger.error(`Error during health check: ${error}`);
      }
    }, 60 * 1000); // Check every 5 minutes
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

  private async checkQueuesStatus() {
    try {
      const queues = AppQueueFactory.getAllQueues();
      console.log(queues.map(q => q.name))
      for (const queue of queues) {
        const jobCounts = await queue.getJobCounts();
        if (jobCounts.active === 0 && jobCounts.waiting === 0 && jobCounts.delayed === 0) {
          console.log(queue.name, jobCounts)
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(`Queue status check failed: ${error}`);
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