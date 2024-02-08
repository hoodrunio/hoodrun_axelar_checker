import App from "./app/App";
import { logger } from "./utils/logger";

import "@extensions/array.extensions";

logger.info("Starting bot...");

async function main() {
  try {
    const app = new App();
    await app.initalizeApplication();
  } catch (error) {
    logger.error(error);
  }

  logger.info("Application initialized");
}

main();
