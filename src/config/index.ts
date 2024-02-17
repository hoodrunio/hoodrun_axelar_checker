import { validateEnv } from "@/config/validateEnv";

let appConfig: AppConfigType | {} = {};

try {
  appConfig = validateEnv();
} catch (error) {
  throw error;
}

export default appConfig as AppConfigType;

export interface AppConfigType {
  maxLastXHourPollVoteNotification: number;
  axelarVoterAddress: string;
  mainnetAxelarRestBaseUrls: string[];
  mainnetAxelarLCDRestBaseUrls: string[];
  mainnetAxelarRpcBaseUrls: string[];
  mainnetAxelarWsUrls: string[];
  tgToken: string;
  dbConnectionString: string | undefined;
  dbName: string;
  dbUser: string;
  dbPwd: string;
  dbHost: string;
  dbPort: string;
  logFormat: string;
  logDir: string;
  redisHost: string;
  redisPort: number;
  uptimeThreshold: {
    low: number;
    medium: number;
    high: number;
  };
}
