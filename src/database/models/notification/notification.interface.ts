import { PollVoteType } from "@/database/models/polls/poll_vote/poll_vote.interface";
import { IBaseInterface, IBaselModel } from "@database/base/model.interface";
import { Document } from "mongoose";
import { VoteType } from "@database/models/amplifier/poll.interface";
import { SignatureType } from "@database/models/amplifier/signature.interface";

export enum NotificationEvent {
  UPTIME = "UPTIME_EVENT",
  POOL_VOTE = "POOL_VOTE_EVENT",
  RPC_ENDPOINT_HEALTH = "RPC_ENDPOINT_HEALTH_EVENT",
  EVM_SUPPORTED_CHAIN_REGISTRATION = "EVM_SUPPORTED_CHAIN_REGISTRATION_EVENT",
  BROADCASTER_BALANCE_LOW = "BROADCASTER_BALANCE_LOW_EVENT",
  AMPLIFIER_VOTE = "AMPLIFIER_VOTE_EVENT",
  AMPLIFIER_SIGNATURE = "AMPLIFIER_SIGNATURE_EVENT",
  WEBSOCKET_CONNECTION_ISSUE = "WEBSOCKET_CONNECTION_ISSUE",
}

export enum NotificationType {
  TELEGRAM = "TELEGRAM",
  EMAIL = "EMAIL",
}

export type WebSocketConnectionNotificationDataType = {
  message: string;
  timestamp: string;
  currentUrl: string;
  retryCount: number;
  nextRetryTime?: string;
  error?: string;
  status?: string;
};

export type NotificationDataType =
  | UptimeNotificationDataType
  | PollVoteNotificationDataType
  | RpcEndpointHealthNotificationDataType
  | EvmSupprtedChainRegistrationNotificationDataType
  | BroadcasterBalanceLowNotificationDataType
  | AmplifierVoteNotificationDataType
  | AmplifierSignatureNotificationDataType
  | WebSocketConnectionNotificationDataType;

export interface INotification extends IBaseInterface {
  notification_id: string;
  event: NotificationEvent;
  data: NotificationDataType;
  condition: string;
  type: NotificationType;
  recipient: string;
  sent: boolean;
  retryCount?: number;
  failed?: boolean;
  lastError?: string;
  created_at?: Date;
  updated_at?: Date;
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

export interface AmplifierVoteNotificationDataType {
  pollId: string;
  voter: string;
  moniker: string;
  vote: VoteType;
  timestamp: number;
}

export interface AmplifierSignatureNotificationDataType {
  sessionId: string;
  verifier: string;
  moniker: string;
  status: SignatureType;
  timestamp: number;
}