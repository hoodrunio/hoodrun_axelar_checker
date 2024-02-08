import AppQueueFactory from "../../queue/AppQueueFactory";
import { logger } from "@utils/logger";
import { AppDb } from "@database/database";
import appJobProducer from "queue/producer/AppJobProducer";
import { TGBot } from "bot/tg/TGBot";
import { createUptimeCondition } from "notification/condition/uptime";
import {
  NotificationEvent,
  NotificationType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";
import { ITelegramUser } from "@database/models/telegram_user/telegram_user.interface";

export const VALIDATOR_UPTIME_CHECKER = "valUptimeChecker";

export const initValsUptimeCheckerQueue = async () => {
  const validatorUptimeCheckerQueue = AppQueueFactory.createQueue(
    VALIDATOR_UPTIME_CHECKER
  );

  validatorUptimeCheckerQueue.process(1, async (job) => {
    const db = new AppDb();
    const activeValidators = await db.validatorRepository.activeValidators();

    const promises = activeValidators.map(async (validator) => {
      const { uptime, operator_address } = validator;

      const event = NotificationEvent.UPTIME;
      const { value: currentUptimeCondition, threshold: closestThreshold } =
        createUptimeCondition({
          operatorAddress: operator_address,
          uptime,
        });

      const validatorTgUsers = await db.telegramUserRepo.findAll({
        operator_addresses: { $in: operator_address },
      });

      const tgUserProcessPromisses = validatorTgUsers.map((tgUser) =>
        processTgUser({
          tgUser,
          operator_address,
          uptime,
          closestThreshold,
          currentUptimeCondition,
          event,
        })
      );
      try {
        await Promise.all(tgUserProcessPromisses);

        return Promise.resolve(validatorTgUsers);
      } catch (error) {
        logger.error("Error in uptime notification creation job", error);
      }
    });

    try {
      (await Promise.all(promises)).removeNulls();
    } catch (error) {
      logger.error("Error in uptime checker job", error);
    }

    return Promise.resolve();
  });
};

interface ProcessTgUserParams {
  tgUser: ITelegramUser;
  operator_address: string;
  uptime: number;
  closestThreshold: number;
  currentUptimeCondition: string;
  event: NotificationEvent;
}

async function processTgUser(params: ProcessTgUserParams) {
  const {
    event,
    tgUser,
    operator_address,
    uptime,
    closestThreshold,
    currentUptimeCondition,
  } = params;

  const db = new AppDb();
  const tgChatId = tgUser.chat_id;
  const notificationId = `uptime-${operator_address}-${tgChatId}`;
  const uptimeNotificationData: UptimeNotificationDataType = {
    operatorAddress: operator_address,
    currentUptime: uptime,
    threshold: closestThreshold,
  };

  const earlierCondition = await db.notificationRepo.findOne({
    event,
    condition: currentUptimeCondition,
  });
  const isNewCondition = !earlierCondition;

  if (isNewCondition) {
    await db.notificationRepo.upsertOne(
      { notification_id: notificationId },
      {
        event,
        data: uptimeNotificationData,
        condition: currentUptimeCondition,
        recipient: tgChatId.toString(),
        type: NotificationType.TELEGRAM,
        sent: false,
      }
    );
  }
}

export const addValUptimeCheckerJob = async () => {
  appJobProducer.addJob(
    VALIDATOR_UPTIME_CHECKER,
    {},
    {
      repeat: { every: 10000 },
    }
  );
};
