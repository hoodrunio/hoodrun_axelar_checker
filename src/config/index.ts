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
} = process.env;

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
};

export default appConfig;
