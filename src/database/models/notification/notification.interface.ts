import { PollVoteType } from "@/database/models/polls/poll_vote/poll_vote.interface";
import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";

export enum NotificationEvent {
  UPTIME = "UPTIME_EVENT",
  POOL_VOTE = "POOL_VOTE_EVENT",
  RPC_ENDPOINT_HEALTH = "RPC_ENDPOINT_HEALTH_EVENT",
  EVM_SUPPORTED_CHAIN_REGISTRATION = "EVM_SUPPORTED_CHAIN_REGISTRATION_EVENT",
  BROADCASTER_BALANCE_LOW = "BROADCASTER_BALANCE_LOW_EVENT",
}

export enum NotificationType {
  TELEGRAM = "TELEGRAM",
  EMAIL = "EMAIL",
}

export interface INotification extends IBaseInterface {
  notification_id: string;
  event: NotificationEvent;
  data:
    | UptimeNotificationDataType
    | PollVoteNotificationDataType
    | RpcEndpointHealthNotificationDataType
    | EvmSupprtedChainRegistrationNotificationDataType
    | BroadcasterBalanceLowNotificationDataType;
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
  pollId: string;
  chain: string;
  vote: PollVoteType;
  operatorAddress: string;
  moniker: string;
}

export interface RpcEndpointHealthNotificationDataType {
  rpcEndpoint: string;
  isHealthy: boolean;
  name: string;
  operatorAddress: string;
  moniker: string;
}

export enum ChainRegistrationStatus {
  REGISTERED = "REGISTERED",
  DEREGISTERED = "DEREGISTERED",
}
export interface EvmSupprtedChainRegistrationNotificationDataType {
  chain: string;
  operatorAddress: string;
  moniker: string;
  status: ChainRegistrationStatus;
}

export interface BroadcasterBalanceLowNotificationDataType {
  balance: number;
  threshold: number;
  operatorAddress: string;
  moniker: string;
}