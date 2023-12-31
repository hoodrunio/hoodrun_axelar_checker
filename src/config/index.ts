import { config } from "dotenv";
config({ path: `.env` });

export const { TG_TOKEN } = process.env;
