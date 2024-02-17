import App from "@/app/App";
import { logger } from "@/utils/logger";

import "@extensions/array.extensions";

logger.info("Starting bot...");
exitHandler();

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

function exitHandler() {
  process.on("uncaughtException", function (err) {
    console.error(err);
    console.log("Node NOT Exiting...");
  });
}
