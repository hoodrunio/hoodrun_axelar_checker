import { AppDb } from "@database/database";
import {
  NotificationEvent,
  NotificationType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";
import { ITelegramUser } from "@database/models/telegram_user/telegram_user.interface";
import { logger } from "@utils/logger";

import appConfig from "@config/index";
import { createUptimeCondition } from "@/notification/condition/uptime";
import { xSeconds } from "@/queue/jobHelper";
import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";

export const VALIDATOR_UPTIME_CHECKER = "valUptimeChecker";

export const initValsUptimeCheckerQueue = async () => {
  const validatorUptimeCheckerQueue = AppQueueFactory.createQueue(
    VALIDATOR_UPTIME_CHECKER
  );

  validatorUptimeCheckerQueue.process(4, async (job) => {
    const db = new AppDb();
    // const activeValidators = [await db.validatorRepository.activeValidators()];
    const activeValidators = [];

    const envValidator = await db.validatorRepository.findOne({
      voter_address: appConfig.axelarVoterAddress,
      is_active: true,
    });

    if (envValidator) {
      activeValidators.push(envValidator);
    }
    const promises = activeValidators.map(async (validator) => {
      const {
        uptime,
        operator_address,
        description: { moniker },
      } = validator;

      const event = NotificationEvent.UPTIME;
      const { value: currentUptimeCondition, threshold: closestThreshold } =
        createUptimeCondition({
          operatorAddress: operator_address,
          uptime,
        });

      // const validatorTgUsers = await db.telegramUserRepo.findAll({
      //   operator_addresses: { $in: operator_address },
      // });

      const tempAllTgUsers = await db.telegramUserRepo.findAll({});

      const tgUserProcessPromisses = tempAllTgUsers.map(
        async (tgUser) =>
          await processTgUser({
            moniker,
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

        return Promise.resolve();
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
  moniker: string;
  operator_address: string;
  uptime: number;
  closestThreshold: number;
  currentUptimeCondition: string;
  event: NotificationEvent;
}

async function processTgUser(params: ProcessTgUserParams) {
  const {
    event,
    moniker,
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
    moniker,
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

export const addValUptimeCheckerJob = () => {
  appJobProducer.addJob(
    VALIDATOR_UPTIME_CHECKER,
    {},
    {
      repeat: { every: xSeconds(10) },
    }
  );
};
