import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum NotificationEvent {
  UPTIME = "UPTIME_EVENT",
  POOL = "POOL_EVENT",
}

export enum NotificationType {
  TELEGRAM = "TELEGRAM",
  EMAIL = "EMAIL",
}

export interface INotification extends IBaseInterface {
  notification_id: string;
  event: NotificationEvent;
  data: UptimeNotificationDataType | PoolNotificationDataType;
  condition: string;
  type: NotificationType;
  recipient: string;
  sent: boolean;
}

export interface INotificationDocument extends Document, INotification {}

export interface INotificationModel
  extends IBaselModel<INotification, INotificationDocument> {}

export interface UptimeNotificationDataType {
  operatorAddress: string;
  currentUptime: number;
  threshold: number;
}

export interface PoolNotificationDataType {
  poolId: string;
}
