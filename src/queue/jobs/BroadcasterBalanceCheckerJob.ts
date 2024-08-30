import appConfig from "@/config/index";
import { AppDb } from "@/database/database";
import { NotificationEvent, NotificationType } from "@/database/models/notification/notification.interface";
import { AxelarBalanceQueryService } from "@/services/rest/AxelarBalanceQueryService";
import { logger } from "@utils/logger";
import { xSeconds } from "queue/jobHelper";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";

const BROADCASTER_BALANCE_CHECKER = "broadcasterBalanceChecker";

export const initBroadcasterBalanceCheckerQueue = async () => {
  const broadcasterBalanceCheckerQueue = AppQueueFactory.createQueue(BROADCASTER_BALANCE_CHECKER);

  broadcasterBalanceCheckerQueue.process(async () => {
    const balanceService = new AxelarBalanceQueryService();
    const { notificationRepo, telegramUserRepo, validatorRepository } = new AppDb();

    try {
      const balance = await balanceService.getBroadcasterBalance();
      
      if (balance < appConfig.broadcasterBalanceThreshold) {
        const envValidator = await validatorRepository.findOne({
          voter_address: appConfig.axelarVoterAddress,
        });

        if (!envValidator) {
          logger.error("Validator not found for the given voter address");
          return;
        }

        const tgUsers = await telegramUserRepo.findAll();

        for (const user of tgUsers) {
          const notificationId = `broadcaster_balance_low_${Date.now()}`;
          
          await notificationRepo.create({
            notification_id: notificationId,
            event: NotificationEvent.BROADCASTER_BALANCE_LOW,
            data: {
              balance,
              threshold: appConfig.broadcasterBalanceThreshold,
              operatorAddress: envValidator.operator_address,
              moniker: envValidator.description.moniker,
            },
            condition: `broadcaster_balance_${appConfig.axelarVoterAddress}`,
            type: NotificationType.TELEGRAM,
            recipient: user.chat_id.toString(),
            sent: false,
          });
        }
      }
    } catch (error) {
      logger.error("Error in broadcaster balance checker job", error);
    }
  });
};

export const addBroadcasterBalanceCheckerJob = () => {
  appJobProducer.addJob(
    BROADCASTER_BALANCE_CHECKER,
    {},
    { repeat: { every: xSeconds(appConfig.broadcasterBalanceCheckInterval) } }
  );
};
