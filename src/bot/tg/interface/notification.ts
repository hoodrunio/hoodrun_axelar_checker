import {
  EvmSupprtedChainRegistrationNotificationDataType,
  PollVoteNotificationDataType,
  RpcEndpointHealthNotificationDataType,
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

export interface RpcEndpointHealthNotification
  extends ISendNotification,
    RpcEndpointHealthNotificationDataType {}
export interface EvmSupprtedChainRegistrationNotification
  extends ISendNotification,
    EvmSupprtedChainRegistrationNotificationDataType {}
