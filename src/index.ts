import App from "./app/App";
import { logger } from "./utils/logger";

logger.info("Starting bot...");

async function main() {
  const app = new App();
  await app.initalizeApplication();

  logger.info("Application initialized");
}

main();
