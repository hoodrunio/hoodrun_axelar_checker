import {
  EvmSupprtedChainRegistrationNotification,
  PollVoteNotification,
  RpcEndpointHealthNotification,
  UptimeNotification,
} from "@/bot/tg/interface/notification";
import {
  BroadcasterBalanceLowNotificationDataType,
  ChainRegistrationStatus,
  AmplifierSignatureNotificationDataType,
  AmplifierVoteNotificationDataType 
} from "@/database/models/notification/notification.interface";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import BigNumber from "bignumber.js";

export class TgReply {
  startReply(): string {
    return `
🚀 <b>Welcome to Axelar Validator Checker!</b>

👋 Hello! I'm your personal Axelar Validator Assistant. I'm here to help you monitor your validator status and uptime.

🔗 <b>Get started with these commands:</b>

📋 /list_validators - View your validators
❓ /help - Learn how to use this bot

Let's keep your validators in top shape! 💪
    `;
  }

  uptimeReply(params: UptimeNotification): string {
    const { moniker, operatorAddress, currentUptime } = params;
    const uptime = new BigNumber(currentUptime).times(100).decimalPlaces(2).toNumber();
    const uptimeEmoji = uptime >= 99 ? "🌟" : uptime >= 95 ? "👍" : "⚠️";

    return `
🕒 <b>${moniker} Uptime Report</b>

🔑 <b>Operator:</b> <code>${operatorAddress}</code>
📊 <b>Uptime:</b> ${uptime}% ${uptimeEmoji}

${this.motivationMessage(uptime)}
    `;
  }

  private pollVoteTitleText(params: PollVoteNotification): string {
    const { moniker, operatorAddress } = params;
    return `🗳️ <b>${moniker} Poll Vote</b>\n\n🔑 <b>Operator:</b> <code>${operatorAddress}</code>`;
  }

  private pollVoteContentText(params: PollVoteNotification): string {
    const { vote, pollId, chain } = params;
    const voteEmoji = vote === PollVoteType.UNSUBMITTED ? "🤷‍♂️" : vote === PollVoteType.YES ? "✅" : "❌";

    return `
🆔 <b>Poll ID:</b> ${pollId}
🔗 <b>Chain:</b> ${chain.toUpperCase()}
🗳️ <b>Vote:</b> ${vote} ${voteEmoji}
🔗 <b>View Poll:</b> <a href="https://axelarscan.io/evm-poll/${pollId}">Axelarscan</a>
    `;
  }

  pollVoteReply(params: PollVoteNotification): string {
    return `${this.pollVoteTitleText(params)}\n\n${this.pollVoteContentText(params)}\n\n${this.motivationMessage()}`;
  }

  batchValidatorPollVoteReply(params: PollVoteNotification[]): string {
    if (params.length === 0) return "📭 No poll vote data found";

    const contents = params.map(param => this.pollVoteContentText(param)).join("\n\n");
    return `${this.pollVoteTitleText(params[0])}\n\n${contents}\n\n${this.motivationMessage()}`;
  }

  rpcEndpointHealthTitle(params: RpcEndpointHealthNotification): string {
    const { moniker, operatorAddress } = params;
    return `🖥️ <b>${moniker} RPC Endpoint Health</b>\n\n🔑 <b>Operator:</b> <code>${operatorAddress}</code>`;
  }

  rpcEndpointHealthContent(params: RpcEndpointHealthNotification): string {
    const { isHealthy, rpcEndpoint, name } = params;
    const status = isHealthy ? "Healthy" : "Unhealthy";
    const icon = isHealthy ? "✅" : "❌";

    return `
🔗 <b>Chain:</b> ${name}
🏥 <b>Status:</b> ${status} ${icon}
🌐 <b>Endpoint:</b> <code>${rpcEndpoint}</code>
    `;
  }

  rpcEndpointHealthReply(params: RpcEndpointHealthNotification): string {
    return `${this.rpcEndpointHealthTitle(params)}\n\n${this.rpcEndpointHealthContent(params)}\n\n${this.motivationMessage()}`;
  }

  rpcEndpointHealthBatchReply(params: RpcEndpointHealthNotification[]): string {
    if (params.length === 0) return "📭 No RPC endpoint health data found";

    const contents = params.map(param => this.rpcEndpointHealthContent(param)).join("\n\n");
    return `${this.rpcEndpointHealthTitle(params[0])}\n\n${contents}\n\n${this.motivationMessage()}`;
  }

  evmSupportedChainReplyTitle(params: EvmSupprtedChainRegistrationNotification): string {
    const { moniker, operatorAddress } = params;
    return `🌐 <b>${moniker} EVM Supported Chain</b>\n\n🔑 <b>Operator:</b> <code>${operatorAddress}</code>`;
  }

  evmSupportedChainReplyContent(params: EvmSupprtedChainRegistrationNotification): string {
    const { status, chain } = params;
    const icon = status === ChainRegistrationStatus.REGISTERED ? "✅" : "❌";
    return `🔗 <b>Chain:</b> ${chain.toUpperCase()}\n📊 <b>Status:</b> ${status} ${icon}`;
  }

  evmSupportedChainReply(params: EvmSupprtedChainRegistrationNotification): string {
    return `${this.evmSupportedChainReplyTitle(params)}\n\n${this.evmSupportedChainReplyContent(params)}\n\n${this.motivationMessage()}`;
  }

  evmSupportedChainBatchReply(params: EvmSupprtedChainRegistrationNotification[]): string {
    if (params.length === 0) return "📭 No EVM supported chain data found";

    const contents = params.map(param => this.evmSupportedChainReplyContent(param)).join("\n\n");
    return `${this.evmSupportedChainReplyTitle(params[0])}\n\n${contents}\n\n${this.motivationMessage()}`;
  }

  amplifierVoteReply(data: AmplifierVoteNotificationDataType): string {
    const { pollId, voter, moniker, vote, timestamp } = data;
    const date = new Date(timestamp).toLocaleString();
    
    return `
🚨 <b>Amplifier Vote Alert</b>

👤 <b>Verifier:</b> <code>${moniker}</code> (${voter})
🆔 <b>Poll ID:</b> <code>${pollId}</code>
🗳️ <b>Vote Status:</b> <b>${vote}</b>
🕒 <b>Time:</b> ${date}

⚠️ This ${vote} vote requires your attention!
    `;
  }

  amplifierSignatureReply(data: AmplifierSignatureNotificationDataType): string {
    const { sessionId, verifier, moniker, status, timestamp } = data;
    const date = new Date(timestamp).toLocaleString();
    
    return `
🚨 <b>Amplifier Signature Alert</b>

👤 <b>Verifier:</b> <code>${moniker}</code> (${verifier})
🆔 <b>Session ID:</b> <code>${sessionId}</code>
✍️ <b>Signature Status:</b> <b>${status}</b>
🕒 <b>Time:</b> ${date}

⚠️ This ${status} signature requires your attention!
    `;
  }

  motivationMessage(uptime?: number): string {
    if (uptime !== undefined) {
      if (uptime >= 99) return "🌟 Excellent uptime! Keep up the fantastic work!";
      if (uptime >= 95) return "👍 Good job! Let's aim for even higher uptime!";
      return "💪 There's room for improvement. Let's work on increasing that uptime!";
    }
    return "🚀 Keep up the great work!";
  }

  successFullAddOperatorAddress(operatorAddress: string): string {
    return `✅ Success! Operator address <code>${operatorAddress}</code> has been added to the chat.`;
  }

  listMessage(list: string[]): string {
    return list.map((item, index) => `${index + 1}. <b>${item}</b>`).join("\n");
  }

  broadcasterBalanceLowReply(params: BroadcasterBalanceLowNotificationDataType): string {
    const { balance, threshold, moniker, operatorAddress } = params;
    const currentBalance = balance / 1000000;
    const thresholdBalance = threshold / 1000000;

    return `
⚠️ <b>${moniker} Broadcaster Balance Alert</b>

🔑 <b>Operator:</b> <code>${operatorAddress}</code>
💰 <b>Current Balance:</b> ${currentBalance.toFixed(6)} AXL
🚨 <b>Threshold:</b> ${thresholdBalance.toFixed(6)} AXL

<b>Warning: Broadcaster balance is below the threshold!</b>
Please top up your balance to ensure uninterrupted operations.
    `;
  }
}