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
  AmplifierVoteNotificationDataType ,
  WebSocketConnectionNotificationDataType
} from "@/database/models/notification/notification.interface";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import appConfig from "@config/index";

export class TgReply {
  private readonly thresholds = appConfig.uptimeThreshold;

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
    
    // Add validation and conversion
    let uptime = 0;
    try {
      // Handle Decimal128 string format from MongoDB
      const uptimeStr = currentUptime?.toString() || '0';
      const uptimeNum = parseFloat(uptimeStr);
      if (!isNaN(uptimeNum)) {
        uptime = uptimeNum;
      }
    } catch (error) {
      console.error('Error processing uptime:', error);
    }
    
    // Convert to percentage for display
    const uptimePercent = Math.round(uptime * 1000) / 10;
    
    // Use custom thresholds for emoji
    const uptimeEmoji = uptime >= this.thresholds.high ? "🌟" : 
                       uptime >= this.thresholds.medium ? "👍" : 
                       uptime >= this.thresholds.low ? "⚠️" : "🚨";

    return `
🕒 <b>${moniker} Uptime Report</b>

🔑 <b>Operator:</b> <code>${operatorAddress}</code>
📊 <b>Uptime:</b> ${uptimePercent}% ${uptimeEmoji}

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
🔗 <b>View Poll:</b> <a href="https://axelarscan.io/evm-poll/${pollId}" disable_web_page_preview="true">Axelarscan</a>
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

  public websocketConnectionIssueReply(data: WebSocketConnectionNotificationDataType): string {
    const timestamp = new Date().toLocaleString();
    const errorDetails = data.error ? `\nError: ${data.error}` : '';
    const currentUrl = data.currentUrl ? `\nCurrent URL: ${data.currentUrl}` : '';
    const retryCount = data.retryCount !== undefined ? `\nRetry Count: ${data.retryCount}` : '';
    const nextRetryTime = data.nextRetryTime ? `\nNext Retry: ${new Date(data.nextRetryTime).toLocaleString()}` : '';
    
    return `⚠️ <b>WebSocket Connection Issue Detected</b>\n
🕒 Time: ${timestamp}
🔌 Status: ${data.status}${errorDetails}${currentUrl}${retryCount}${nextRetryTime}

${data.message || 'Attempting to maintain connection...'}`;
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
      if (uptime >= this.thresholds.high) 
        return "🌟 Excellent uptime! Keep up the fantastic work!";
      if (uptime >= this.thresholds.medium) 
        return "👍 Good uptime, but we can do better! Aim for ${(this.thresholds.high * 100).toFixed(1)}%";
      if (uptime >= this.thresholds.low)
        return "⚠️ Warning: Uptime is below target. Let's improve it to reach ${(this.thresholds.medium * 100).toFixed(1)}%";
      return "🚨 Critical: Uptime needs immediate attention! Target: ${(this.thresholds.low * 100).toFixed(1)}%";
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