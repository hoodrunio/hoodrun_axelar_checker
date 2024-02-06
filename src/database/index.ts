import { connect, set } from "mongoose";
import appConfig from "src/config";

const { dbConnectionString, dbName, dbUser, dbPwd, dbHost, dbPort } = appConfig;

const connectionString = dbConnectionString
  ? dbConnectionString
  : `mongodb://${dbUser}:${dbUser}@${dbHost}:${dbPort}/${dbName}`;

export const connectDb = async (env: string) => {
  if (env !== "production") {
    set("debug", true);
  }

  console.log("Connecting to the database...", { connectionString });

  try {
    const connectionRes = await connect(connectionString, {
      dbName: dbName,
    });
    console.log("Connected to the database");
  } catch (error) {
    console.error(`Database connection failed: ${error}`);
    throw error;
  }
};
