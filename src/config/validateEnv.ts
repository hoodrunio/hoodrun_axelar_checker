// src/config/validateEnv.ts

import { AppConfigType } from "@/config/index";
import { parseRpcEndpoints } from "@/config/parseRpcEndpoints";
import { isValidVoterAddress } from "@utils/cosmos/axelar/addressUtil";
import { isSafeUrl } from "@utils/url";
import { config } from "dotenv";
config({ path: `.env` });

const {
  //Telegram
  TG_TOKEN,
  //URLs
  MAINNET_AXELAR_REST_BASE_URLS,
  MAINNET_AXELAR_RPC_BASE_URLS,
  MAINNET_AXELAR_LCD_REST_BASE_URLS,
  MAINNET_AXELAR_WS_URLS,
  TESTNET_AXELAR_REST_BASE_URLS,
  //Axelar
  AXELAR_VOTER_ADDRESS,
  BROADCASTER_BALANCE_THRESHOLD,
  BROADCASTER_BALANCE_CHECK_INTERVAL,
  UPTIME_THRESHOLD_LOW,
  UPTIME_THRESHOLD_MEDIUM,
  UPTIME_THRESHOLD_HIGH,
  LAST_X_HOUR_POLL_VOTE_NOTIFICATION,
  //DB
  DB_CONNECTION_STRING,
  DB_NAME,
  DB_USER,
  DB_PWD,
  DB_HOST,
  DB_PORT,
  //Utils
  LOG_FORMAT,
  LOG_DIR,
  //Redis
  REDIS_HOST,
  REDIS_PORT,
} = process.env;

const isDev = process.env.NODE_ENV === "development";
const defaultRedisHost = "127.0.0.1";
const defaultRedisPort = "6379";

const broadcasterBalanceThreshold = parseInt(BROADCASTER_BALANCE_THRESHOLD as string);
if (isNaN(broadcasterBalanceThreshold) || broadcasterBalanceThreshold <= 0) {
  throw new Error('Invalid BROADCASTER_BALANCE_THRESHOLD');
}

const broadcasterBalanceCheckInterval = parseInt(BROADCASTER_BALANCE_CHECK_INTERVAL as string);
if (isNaN(broadcasterBalanceCheckInterval) || broadcasterBalanceCheckInterval <= 0) {
  throw new Error('Invalid BROADCASTER_BALANCE_CHECK_INTERVAL');
}

export const validateEnv = (): AppConfigType => {
  const maxLastXHourPollVoteNotification = LAST_X_HOUR_POLL_VOTE_NOTIFICATION ?? "12";
  const urlArrays: { [x: string]: string[] } = {
    mainnetAxelarRpcBaseUrls: parseStringArray(MAINNET_AXELAR_RPC_BASE_URLS),
    mainnetAxelarRestBaseUrls: parseStringArray(MAINNET_AXELAR_REST_BASE_URLS),
    mainnetAxelarWsUrls: parseStringArray(MAINNET_AXELAR_WS_URLS),
    mainnetAxelarLCDRestBaseUrls: parseStringArray(MAINNET_AXELAR_LCD_REST_BASE_URLS),
  };

  for (const prop in urlArrays) {
    const urls = urlArrays[prop];
    urls.forEach((url) => {
      if (!isSafeUrl(url)) {
        throw new Error(`‼️ Invalid URL for ${prop} with !! this ${url} !! in Env file please fix it`);
      }
    });
  }

  const axelarVoterAddress = AXELAR_VOTER_ADDRESS as string;
  if (!isValidVoterAddress(axelarVoterAddress)) {
    throw new Error(`‼️ Invalid Axelar Voter Address in Env file please fix it : ${axelarVoterAddress}`);
  }

  if (isNaN(parseFloat(BROADCASTER_BALANCE_THRESHOLD as string))) {
    throw new Error('‼️ Invalid BALANCE_THRESHOLD in Env file');
  }

  const balanceThreshold = parseFloat(BROADCASTER_BALANCE_THRESHOLD as string);

  return {
    axelarVoterAddress,
    parsedRpcEndpoints: parseRpcEndpoints(),
    uptimeThreshold: {
      low: parseFloat(UPTIME_THRESHOLD_LOW as string),
      medium: parseFloat(UPTIME_THRESHOLD_MEDIUM as string),
      high: parseFloat(UPTIME_THRESHOLD_HIGH as string),
    },
    maxLastXHourPollVoteNotification: parseInt(maxLastXHourPollVoteNotification),
    mainnetAxelarRestBaseUrls: urlArrays.mainnetAxelarRestBaseUrls,
    mainnetAxelarLCDRestBaseUrls: urlArrays.mainnetAxelarLCDRestBaseUrls,
    mainnetAxelarRpcBaseUrls: urlArrays.mainnetAxelarRpcBaseUrls,
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
    redisHost: isDev ? defaultRedisHost : (REDIS_HOST as string),
    redisPort: parseInt(REDIS_PORT ?? defaultRedisPort),
    broadcasterBalanceThreshold,
    broadcasterBalanceCheckInterval,
    balanceThreshold,
  };
};

function parseStringArray(str?: string): string[] {
  return JSON.parse(str ?? "[]");
}