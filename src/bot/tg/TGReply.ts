import {
  EvmSupprtedChainRegistrationNotification,
  PollVoteNotification,
  RpcEndpointHealthNotification,
  UptimeNotification,
} from "@/bot/tg/interface/notification";
import {
  BroadcasterBalanceLowNotificationDataType, ChainRegistrationStatus, AmplifierSignatureNotificationDataType, AmplifierVoteNotificationDataType 
} from "@/database/models/notification/notification.interface";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";

import BigNumber from "bignumber.js";

export class TgReply {
  startReply() {
    return `
<b style="text-align:center"><strong>Welcome HoodRun Axelar Validator Checker 🚀 </strong></b>

<b>👋 Hello! I'm Axelar Validator Checker Bot. I can help you to check your validator status and uptime. </b>

<b>🔗 To get started, you can use the following commands:</b>


- /list_validators - List your validators
- /help - To see how bot works
    `;
  }

  uptimeReply(params: UptimeNotification): string {
    const { moniker, operatorAddress, currentUptime } = params;
    const uptime = new BigNumber(currentUptime)
      .times(100)
      .decimalPlaces(2)
      .toNumber();
    return `
<b><strong>${moniker} Uptime</strong></b>

<b>Operator Address:</b> ${operatorAddress}
<b>Uptime:</b> ${uptime}% <b>🤘</b>

<b>${this.motivationMessage()}</b>
`;
  }

  private pollVoteTitleText(params: PollVoteNotification): string {
    const { moniker, operatorAddress } = params;
    return `<b><strong>${moniker} Poll Vote</strong></b>\n\n<b>Operator Address:</b> ${operatorAddress}`;
  }

  private pollVoteContentText(params: PollVoteNotification) {
    const { vote, pollId, chain } = params;
    let voteEmoji = "";
    if (vote == PollVoteType.UNSUBMITTED) {
      voteEmoji = "🤷‍♂️";
    } else if (vote == PollVoteType.YES) {
      voteEmoji = "✅";
    } else {
      voteEmoji = "❌";
    }

    return `<b>Pool ID:</b> ${pollId}\n<b>Vote:</b> ${vote} ${voteEmoji}\n<b>Chain:</b> ${chain.toUpperCase()}\n<b>Link To Poll:</b> https://axelarscan.io/evm-poll/${pollId}\n`;
  }

  pollVoteReply(params: PollVoteNotification): string {
    return `${this.pollVoteTitleText(params)}\n${this.pollVoteContentText(
      params
    )}\n<b>${this.motivationMessage()}</b>`;
  }

  batchValidatorPollVoteReply(params: PollVoteNotification[]): string {
    if (params.length == 0) {
      return `No poll vote data found`;
    }
    const contents = params
      .map((param) => {
        return `\n${this.pollVoteContentText(param)}\n`;
      })
      .join(" ");

    return `${this.pollVoteTitleText(
      params[0]
    )}\n${contents}\n<b>${this.motivationMessage()}</b>`;
  }

  rpcEndpointHealthTitle(params: RpcEndpointHealthNotification): string {
    const { moniker, operatorAddress } = params;
    return `<b><strong>${moniker} RPC Endpoint Health</strong></b>\n<b>Operator Address:</b> ${operatorAddress}`;
  }

  rpcEndpointHealthContent(params: RpcEndpointHealthNotification) {
    const { isHealthy, rpcEndpoint, name } = params;
    const status = isHealthy ? "Healthy" : "Unhealthy";
    const icon = isHealthy ? "✅" : "❌";
    return `<b>RPC Chain:</b> ${name}\n<b>RPC Status:</b> ${status} ${icon}\n<b>RPC Endpoint:</b> ${rpcEndpoint}`;
  }

  rpcEndpointHealthReply(params: RpcEndpointHealthNotification): string {
    return `${this.rpcEndpointHealthTitle(
      params
    )}\n\n${this.rpcEndpointHealthContent(
      params
    )}\n\n<b>${this.motivationMessage()}</b>
    `;
  }

  rpcEndpointHealthBatchReply(params: RpcEndpointHealthNotification[]): string {
    if (params.length == 0) {
      return `No rpc endpoint health data found`;
    }
    const contents = params
      .map((param) => {
        return `\n${this.rpcEndpointHealthContent(param)}\n`;
      })
      .join(" ");

    return `${this.rpcEndpointHealthTitle(
      params[0]
    )}\n${contents}\n<b>${this.motivationMessage()}</b>`;
  }

  evmSupportedChainReplyTitle(
    params: EvmSupprtedChainRegistrationNotification
  ): string {
    const { moniker, operatorAddress } = params;
    return `<b><strong>${moniker} EVM Supported Chain</strong></b>\n\n<b>Operator Address:</b> ${operatorAddress}`;
  }

  evmSupportedChainReplyContent(
    params: EvmSupprtedChainRegistrationNotification
  ): string {
    const { status } = params;
    const icon = status == ChainRegistrationStatus.REGISTERED ? "✅" : "❌";
    return `<b>Chain:</b> ${params.chain.toUpperCase()}\n<b>Status:</b> ${status} ${icon}`;
  }
  evmSupportedChainReply(
    params: EvmSupprtedChainRegistrationNotification
  ): string {
    return `${this.evmSupportedChainReplyTitle(
      params
    )}\n\n${this.evmSupportedChainReplyContent(
      params
    )}\n\n<b>${this.motivationMessage()}</b>
    `;
  }

  evmSupportedChainBatchReply(
    params: EvmSupprtedChainRegistrationNotification[]
  ): string {
    if (params.length == 0) {
      return `No evm supported chain data found`;
    }
    const contents = params
      .map((param) => {
        return `\n${this.evmSupportedChainReplyContent(param)}\n`;
      })
      .join(" ");

    return `${this.evmSupportedChainReplyTitle(
      params[0]
    )}\n${contents}\n<b>${this.motivationMessage()}</b>`;
  }

  amplifierVoteReply(data: AmplifierVoteNotificationDataType): string {
    const { pollId, voter, moniker, vote, timestamp } = data;
    const date = new Date(timestamp).toLocaleString();
    
    return `🚨 <b>Amplifier Vote Alert</b>

Verifier: <code>${moniker}</code> (${voter})
Poll ID: <code>${pollId}</code>
Vote Status: <b>${vote}</b>
Time: ${date}

This vote requires attention as it is either NO or UNSUBMITTED.`;
  }

  amplifierSignatureReply(data: AmplifierSignatureNotificationDataType): string {
    const { sessionId, verifier, moniker, status, timestamp } = data;
    const date = new Date(timestamp).toLocaleString();
    
    return `🚨 <b>Amplifier Signature Alert</b>

Verifier: <code>${moniker}</code> (${verifier})
Session ID: <code>${sessionId}</code>
Signature Status: <b>${status}</b>
Time: ${date}

This signature requires attention as it is either INVALID or UNSUBMITTED.`;
  }

  motivationMessage() {
    return `🚀 Keep up the good work!`;
  }

  successFullAddOperatorAddress(operatorAddress: string) {
    return `Operator address ${operatorAddress} has been added to the chat`;
  }

  listMessage(list: string[]) {
    const htmlMessage = list
      .map((platform, index) => `<b>${index + 1}. ${platform}</b>`)
      .join("\n");
    return htmlMessage;
  }

  broadcasterBalanceLowReply(params: BroadcasterBalanceLowNotificationDataType): string {
    const { balance, threshold, moniker, operatorAddress } = params;
    return `
<b><strong>${moniker} Broadcaster Balance Low</strong></b>

<b>Operator Address:</b> ${operatorAddress}
<b>Current Balance:</b> ${balance / 1000000} AXL
<b>Threshold:</b> ${threshold / 1000000} AXL

<b>⚠️ Warning: Broadcaster balance is below the threshold!</b>
`;
  }
}