// src/queue/jobs/validators/BroadcasterBalanceChecker.ts

import appConfig from '@/config/index';
import { AxelarQueryService } from '@/services/rest/AxelarQueryService';
import { TGBot } from '@/bot/tg/TGBot';
import { logger } from '@/utils/logger';
import { AppDb } from '@/database/database';

export const checkBroadcasterBalance = async () => {
    const axelarQueryService = new AxelarQueryService();
    const tgBot = await TGBot.getInstance();

    const BROADCASTER_ADDRESS = appConfig.axelarVoterAddress;
    const THRESHOLD = appConfig.balanceThreshold;

    try {
        const balance = await axelarQueryService.getBroadcasterBalance(BROADCASTER_ADDRESS);
        if (balance < THRESHOLD) {
            const { telegramUserRepo } = new AppDb();
            const tgUsers = await telegramUserRepo.findAll({});

            if (tgUsers && tgUsers.length > 0) {
                const message = `Warning: Broadcaster balance is below the threshold. Current balance: ${balance}`;
                for (const tgUser of tgUsers) {
                    await tgBot.sendMessageToUser({ chat_id: tgUser.chat_id }, message);
                }
                logger.info(message);
            }
        }
    } catch (error) {
        logger.error('Error checking broadcaster balance', error);
    }
};
