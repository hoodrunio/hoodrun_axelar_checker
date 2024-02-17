import App from "./app/App";
import { logger } from "./utils/logger";

import "@extensions/array.extensions";

logger.info("Starting bot...");

async function main() {
  exitHandler();
  try {
    const app = new App();
    await app.initalizeApplication();
  } catch (error) {
    logger.error(error);
  }

  logger.info("Application initialized");
}

main();

const exitHandler = async () => {
  process.on("uncaughtException", function (err) {
    console.error(err);
    console.log("Node NOT Exiting...");
  });
};
