import { isValidVoterAddress } from "@utils/cosmos/axelar/addressUtil";
import { isSafeUrl } from "@utils/url";
import { config } from "dotenv";
config({ path: `.env` });

const {
  TG_TOKEN,
  MAINNET_AXELAR_REST_BASE_URLS,
  AXELAR_VOTER_ADDRESS,
  MAINNET_AXELAR_LCD_REST_BASE_URLS,
  MAINNET_AXELAR_WS_URLS,
  TESTNET_AXELAR_REST_BASE_URLS,
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

export const validateEnv = () => {
  const urlArrays: { [x: string]: string[] } = {
    mainnetAxelarRestBaseUrls: parseStringArray(MAINNET_AXELAR_REST_BASE_URLS),
    mainnetAxelarLCDRestBaseUrls: parseStringArray(
      MAINNET_AXELAR_LCD_REST_BASE_URLS
    ),
    mainnetAxelarWsUrls: parseStringArray(MAINNET_AXELAR_WS_URLS),
  };

  for (const prop in urlArrays) {
    const urls = urlArrays[prop];
    urls.forEach((url) => {
      if (!isSafeUrl(url)) {
        throw new Error(
          `‼️ Invalid URL for ${prop} with !! this ${url} !! in Env file please fix it`
        );
      }
    });
  }

  const axelarVoterAddress = AXELAR_VOTER_ADDRESS as string;
  if (!isValidVoterAddress(axelarVoterAddress)) {
    throw new Error(
      `‼️ Invalid Axelar Voter Address in Env file please fix it : ${axelarVoterAddress}`
    );
  }

  return {
    axelarVoterAddress,
    mainnetAxelarRestBaseUrls: urlArrays.mainnetAxelarRestBaseUrls,
    mainnetAxelarLCDRestBaseUrls: urlArrays.mainnetAxelarLCDRestBaseUrls,
    mainnetAxelarWsUrls: urlArrays.mainnetAxelarWsUrls,
    tgToken: TG_TOKEN as string,
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
};

function parseStringArray(str?: string): string[] {
  return JSON.parse(str ?? "[]");
}
