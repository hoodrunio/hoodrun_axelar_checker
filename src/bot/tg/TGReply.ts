import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import {
  PollVoteNotification,
  UptimeNotification,
} from "./interface/notification";
import BigNumber from "bignumber.js";

export class TgReply {
  startReply() {
    return `
<b style="text-align:center"><strong>Welcome HoodRun Axelar Validator Checker 🚀 </strong></b>

<b>👋 Hello! I'm Axelar Validator Checker Bot. I can help you to check your validator status and uptime. </b>

<b>🔗 To get started, you can use the following commands:</b>

- /add_operator_address - Add your operator address
- /list_operators - List your operator addresses
- /uptime - Check uptime for your operator address
- /help - Get help
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

<b>🚀 Keep up the good work! </b>
    `;
  }

  pollVoteReply(params: PollVoteNotification): string {
    const { moniker, operatorAddress, vote, poolId } = params;
    let voteEmoji = "";
    if (vote == PollVoteType.UNSUBMITTED) {
      voteEmoji = "🤷‍♂️";
    } else if (vote == PollVoteType.YES) {
      voteEmoji = "✅";
    } else {
      voteEmoji = "❌";
    }
    return `
<b><strong>${moniker} Poll Vote</strong></b>

<b>Operator Address:</b> ${operatorAddress}
<b>Pool ID:</b> ${poolId}
<b>Vote:</b> ${vote} ${voteEmoji}

<b>🚀 Keep up the good work! </b>
    `;
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
}
