import { AppDb } from "@database/database";
import { TelegramChatType } from "@database/models/telegram_user/telegram_user.interface";
import { Context, NextFunction } from "grammy";

export async function chatSaverMiddleware(
  ctx: Context,
  next: NextFunction,
  db: AppDb
): Promise<void> {
  db.telegramUserRepo.upsertOne(
    { chat_id: ctx.chat?.id },
    {
      chat_id: ctx.chat?.id,
      type: ctx.chat?.type as TelegramChatType,
      _chat: ctx.chat,
    }
  );

  await next();
}
