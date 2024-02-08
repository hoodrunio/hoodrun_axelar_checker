import { config } from "dotenv";
config({ path: `.env` });

const {
  TG_TOKEN,
  MAINNET_AXELAR_REST_BASE_URL,
  TESTNET_AXELAR_REST_BASE_URL,
  DB_CONNECTION_STRING,
  DB_NAME,
  DB_USER,
  DB_PWD,
  DB_HOST,
  DB_PORT,
  LOG_FORMAT,
  LOG_DIR,
  REDIS_HOST,
  REDIS_PORT,
} = process.env;

const isDev = process.env.NODE_ENV === "development";
const defatultRedisHost = "localhost";
const defaultRedisPort = "6379";

const appConfig = {
  tgToken: TG_TOKEN as string,
  mainnetAxelarRestBaseUrl: MAINNET_AXELAR_REST_BASE_URL as string,
  testnetAxelarRestBaseUrl: TESTNET_AXELAR_REST_BASE_URL as string,
  dbConnectionString: DB_CONNECTION_STRING,
  dbName: DB_NAME as string,
  dbUser: DB_USER as string,
  dbPwd: DB_PWD as string,
  dbHost: DB_HOST as string,
  dbPort: DB_PORT as string,
  logFormat: LOG_FORMAT as string,
  logDir: LOG_DIR as string,
  redisHost: isDev ? defatultRedisHost : (REDIS_HOST as string),
  redisPort: parseInt(REDIS_PORT ?? defaultRedisPort),
};

export default appConfig;
