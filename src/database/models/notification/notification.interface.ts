import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";
import { PollVoteType } from "../polls/poll_vote/poll_vote.interface";

export enum NotificationEvent {
  UPTIME = "UPTIME_EVENT",
  POOL_VOTE = "POOL_VOTE_EVENT",
}

export enum NotificationType {
  TELEGRAM = "TELEGRAM",
  EMAIL = "EMAIL",
}

export interface INotification extends IBaseInterface {
  notification_id: string;
  event: NotificationEvent;
  data: UptimeNotificationDataType | PollVoteNotificationDataType;
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
  moniker: string;
  currentUptime: number;
  threshold: number;
}

export interface PollVoteNotificationDataType {
  poolId: string;
  vote: PollVoteType;
  operatorAddress: string;
  moniker: string;
}
