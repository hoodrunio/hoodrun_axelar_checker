import appConfig from "@config/index";
import { logger } from "@utils/logger";
import Queue from "bull";
<<<<<<< Updated upstream
import Redis from "ioredis";
=======
import Redis from 'ioredis';
import { createClient } from "redis";
>>>>>>> Stashed changes

const { redisHost, redisPort } = appConfig;

const redisClient = new Redis({
  host: appConfig.redisHost || 'redis',
  port: appConfig.redisPort || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

<<<<<<< Updated upstream
redisClient.on('error', (hata: Error) => {
  logger.error(`Redis connection error: ${hata.message}`);
  logger.error(`Redis connection details: host=${redisHost}, port=${redisPort}`);
});

redisClient.on('connect', () => {
  logger.info('Successfully connected to Redis');
});

redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
=======
redisClient.on('error', (error) => {
  logger.error(`Redis connection error: ${error.message}`);
  logger.error(`Redis connection details: host=${appConfig.redisHost || 'redis'}, port=${appConfig.redisPort || 6379}`);
>>>>>>> Stashed changes
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

  public static getQueue(name: string): Queue.Queue {
    if (!this.queues[name]) {
      this.queues[name] = this.createQueue(name);
    }
    return this.queues[name];
  }

  public static createQueue<T>(name: string): Queue.Queue<T> {
    if (!this.queues[name]) {
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
            removeOnComplete: true,
            removeOnFail: false,
          },
        });
        this.onQueueError(queue, name);
        this.onQueueCompleted(queue, name);
        
        this.queues[name] = queue;
        logger.info(`Queue ${name} created successfully`);
      } catch (error) {
        logger.error(`Error creating queue ${name}: ${error}`);
        throw error;
      }
    } else {
      logger.info(`Queue ${name} already exists. Using existing queue.`);
    }

    return this.queues[name];
  }

  private static onQueueError(queue: Queue.Queue, name: string) {
    queue.on("error", (error) => {
      logger.error(`Queue ${name} error: ${error}`);
    });
  }

  private static onQueueCompleted(queue: Queue.Queue, name: string) {
    queue.on("completed", (job) => {
      logger.info(`Queue ${name} job completed: ${job.id}`);
    });
  }

  public static async checkRedisConnection() {
    try {
      await redisClient.ping();
      logger.info("Redis connection check passed.");
      return true;
    } catch (error) {
      logger.error('Redis connection check failed:', error);
      return false;
    }
  }

  public static getAllQueues(): Queue.Queue[] {
    return Object.values(this.queues);
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

export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379'
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

export default AppQueueFactory;