import { validateEnv } from "./validateEnv";

let appConfig = {};

try {
  appConfig = validateEnv();
} catch (error) {
  throw error;
}

console.log(appConfig);

export default appConfig;
