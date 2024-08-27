import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 20;
import App from "@/app/App";
import { logger } from "@/utils/logger";
import "@extensions/array.extensions";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import { testRedisConnection } from "queue/queue/AppQueueFactory";
import appConfig from "@config/index";

// There are some duplicated loggers in the codebase. We can remove the following loggers:
// logger.info("Starting bot...");
// logger.info(`Redis configuration: host=${appConfig.redisHost}, port=${appConfig.redisPort}`);

setupExitHandlers();

async function main() {
  try {
    logger.info("Starting bot...");
    logger.info(`Redis configuration: host=${appConfig.redisHost}, port=${appConfig.redisPort}`);

    logger.info("Testing Redis connection...");
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      throw new Error("Redis connection failed.");
    }
    logger.info("Redis connection successful.");

    const app = new App();
    await app.initalizeApplication();
    logger.info("Application initialized and running");
  } catch (error) {
    logger.error("Fatal error:", error);
    await gracefulShutdown('FATAL_ERROR');
  }
}

function setupExitHandlers() {
  process.on("uncaughtException", async (err) => {
    logger.error("Uncaught Exception:", err);
    await gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on("unhandledRejection", async (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    await gracefulShutdown('UNHANDLED_REJECTION');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

const app = new App();

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  try {
    await AppQueueFactory.closeAll();
    await app.shutdown();
    logger.info('Application shut down successfully');
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
  } finally {
    process.exit(signal === 'FATAL_ERROR' ? 1 : 0);
  }
}

main().catch((error) => {
  logger.error("Unhandled error in main function:", error);
  gracefulShutdown('UNHANDLED_ERROR');
});