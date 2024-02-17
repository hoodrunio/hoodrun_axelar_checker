import {
  PollVoteNotificationDataType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";

export interface ISendNotification {
  chat_id: number;
}

export interface PollVoteNotification
  extends PollVoteNotificationDataType,
    ISendNotification {}
export interface UptimeNotification
  extends UptimeNotificationDataType,
    ISendNotification {}
