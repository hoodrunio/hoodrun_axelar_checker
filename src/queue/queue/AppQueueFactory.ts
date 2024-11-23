import appConfig from "@config/index";
import { logger } from "@utils/logger";
import Queue from "bull";
import Redis from 'ioredis';

const { redisHost, redisPort } = appConfig;

const redisClient = new Redis({
  host: appConfig.redisHost,
  port: appConfig.redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (error) => {
  logger.error(`Redis connection error: ${error.message}`);
  logger.error(`Redis connection details: host=${redisHost}, port=${redisPort}`);
});

redisClient.on('connect', () => {
  logger.info('Successfully connected to Redis');
});

redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
});

class AppQueueFactory {
  private static queues: { [key: string]: Queue.Queue } = {};
  private static instance: AppQueueFactory;

  private constructor() {}

  public static getInstance(): AppQueueFactory {
    if (!AppQueueFactory.instance) {
      AppQueueFactory.instance = new AppQueueFactory();
    }
    return AppQueueFactory.instance;
  }

  public static async getQueue<T = any>(name: string): Promise<Queue.Queue<T>> {
    if (!this.queues[name]) {
      this.queues[name] = this.createQueue<T>(name);
    }
    return this.queues[name];
  }

  public static createQueue<T>(name: string, deleteOnCompleted?: boolean): Queue.Queue<T> {
    try {
      const queue = new Queue(name, {
        createClient: (type) => {
          switch (type) {
            case 'client':
              return redisClient;
            case 'subscriber':
              return redisClient.duplicate();
            case 'bclient':
              return redisClient.duplicate();
            default:
              return redisClient;
          }
        },
        limiter: { max: 5000, duration: 1000 },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: false, // Don't remove completed jobs by default for repeatable jobs
          removeOnFail: false,
          timeout: 30000, // 30 second timeout
        },
        settings: {
          stalledInterval: 30000, // Check for stalled jobs every 30 seconds
          maxStalledCount: 2, // Consider a job stalled after 2 checks
          drainDelay: 5, // Small delay between processing jobs
        }
      });

      // Set up queue-level error handling
      queue.on('error', (error) => {
        logger.error(`Queue ${name} error:`, error);
      });

      queue.on('waiting', (jobId) => {
        logger.debug(`Job ${jobId} is waiting in queue ${name}`);
      });

      queue.on('active', (job) => {
        logger.debug(`Processing job ${job.id} in queue ${name}`);
      });

      queue.on('completed', (job) => {
        logger.info(`Job ${job.id} completed in queue ${name}`);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed in queue ${name}:`, error);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} has stalled in queue ${name}`);
      });

      return queue;
    } catch (error) {
      logger.error(`Error creating queue ${name}: ${error}`);
      throw error;
    }
  }

  public static async checkRedisConnection() {
    try {
      await redisClient.ping();
      return true;
    } catch (error) {
      logger.error('Redis connection check failed:', error);
      return false;
    }
  }

  public static getAllQueues(): Queue.Queue[] {
    return Object.values(this.queues);
  }

  public static async removeQueue(name: string) {
    if (this.queues[name]) {
      try {
        const queue = this.queues[name];
        // Remove all listeners first
        queue.removeAllListeners();
        // Remove all jobs
        await queue.empty();
        // Clean up any failed jobs
        await queue.clean(0, 'failed');
        // Clean up any completed jobs
        await queue.clean(0, 'completed');
        // Close the queue
        await queue.close(true);
        // Remove from our cache
        delete this.queues[name];
        logger.info(`Queue ${name} removed successfully`);
      } catch (error) {
        logger.error(`Error removing queue ${name}:`, error);
        throw error;
      }
    }
  }

  public static async closeAll() {
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        await queue.close();
        logger.info(`Queue ${name} closed successfully`);
      } catch (error) {
        logger.error(`Error closing queue ${name}: ${error}`);
      }
    }
    await redisClient.quit();
    logger.info('Redis connection closed');
  }

  public static async removeAllQueueListeners() {
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        queue.removeAllListeners();
        logger.info(`Removed all listeners from queue ${name}`);
      } catch (error) {
        logger.error(`Error removing listeners from queue ${name}: ${error}`);
      }
    }
  }
}

export async function testRedisConnection() {
  const client = new Redis({
    host: appConfig.redisHost,
    port: appConfig.redisPort,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: () => null,
    connectTimeout: 5000,
  });

  try {
    logger.info(`Attempting to connect to Redis at ${appConfig.redisHost}:${appConfig.redisPort}`);
    await client.ping();
    logger.info('Redis connection test successful');
    await client.quit();
    return true;
  } catch (error) {
    logger.error('Redis connection check failed:', error);
    logger.error(`Redis connection details: host=${appConfig.redisHost}, port=${appConfig.redisPort}`);
    await client.quit();
    return false;
  }
}

export default AppQueueFactory;