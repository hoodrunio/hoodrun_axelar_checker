import { TGBot } from "./bot/tg/TGBot";

console.log("Starting bot...");

const tgBot = await TGBot.getInstance();

console.log("Bot started!");
