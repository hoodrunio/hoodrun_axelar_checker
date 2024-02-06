import { connect, set } from "mongoose";
import appConfig from "src/config";
import { logger } from "src/utils/logger";

const { dbConnectionString, dbName, dbUser, dbPwd, dbHost, dbPort } = appConfig;

const connectionString = dbConnectionString
  ? dbConnectionString
  : `mongodb://${dbUser}:${dbUser}@${dbHost}:${dbPort}/${dbName}`;

export const connectDb = async (env: string) => {
  if (env !== "production") {
    set("debug", true);
  }

  logger.info("Connecting to the database...", { connectionString });

  try {
    await connect(connectionString, {
      dbName: dbName,
    });
    logger.info("Connected to the database");
  } catch (error) {
    logger.error(`Database connection failed: ${error}`);
    throw error;
  }
};
