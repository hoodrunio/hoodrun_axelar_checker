import { AppDb } from "@database/database";
import { NotificationType } from "@database/models/notification/notification.interface";
import { logger } from "@utils/logger";
import { TGBot } from "bot/tg/TGBot";
import { xSeconds } from "queue/jobHelper";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";

const SEND_NOTIFICATIONS_JOB = "sendNotificationsJob";

export const initSendNotificationsQueue = async () => {
  const sendNotificationsQueue = AppQueueFactory.createQueue(
    SEND_NOTIFICATIONS_JOB
  );

  sendNotificationsQueue.process(async () => {
    const { notificationRepo } = new AppDb();
    const notSendNotifications = await notificationRepo.findAll({
      sent: false,
      sort: { createdAt: 1 },
    });

    const promises = notSendNotifications?.map(async (notification) => {
      const { type, notification_id } = notification;
      const tgBot = await TGBot.getInstance();

      switch (type) {
        case NotificationType.TELEGRAM:
          await tgBot.sendNotification(notification);
          break;
        default:
          break;
      }

      await notificationRepo.updateOne({ notification_id }, { sent: true });
    });

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error("Error while sending notifications", error);
    }
  });
};

export const addSendNotificationsJob = async () => {
  appJobProducer.addJob(
    SEND_NOTIFICATIONS_JOB,
    {},
    { repeat: { every: xSeconds(10) } }
  );
};
