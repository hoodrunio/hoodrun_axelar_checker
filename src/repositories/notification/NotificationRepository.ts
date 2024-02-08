import {
  INotification,
  INotificationDocument,
} from "@database/models/notification/notification.interface";
import NotificationDbModel from "@database/models/notification/notification.model";
import BaseRepository from "@repositories/base.repository";

export class NotificationRepository extends BaseRepository<
  INotification,
  INotificationDocument
> {
  constructor() {
    super(NotificationDbModel);
  }
}
