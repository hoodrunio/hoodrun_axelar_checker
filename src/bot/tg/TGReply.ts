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


- /list_validators - List your validators
    `;
  }

  //- /add_operator_address - Add your operator address
  // - /uptime - Check uptime for your operator address
  // - /help - Get help

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

  private pollVoteTitleText(params: PollVoteNotification): string {
    const { moniker, operatorAddress } = params;
    return `
<b><strong>${moniker} Poll Vote</strong></b>

<b>Operator Address:</b> ${operatorAddress}
    `;
  }

  private pollVoteContentText(params: PollVoteNotification) {
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
<b>Pool ID:</b> ${poolId}
<b>Vote:</b> ${vote} ${voteEmoji}
`;
  }

  pollVoteReply(params: PollVoteNotification): string {
    return `
${this.pollVoteTitleText(params)}

${this.pollVoteContentText(params)}
<b>🚀 Keep up the good work! </b>
`;
  }

  batchValidatorPollVoteReply(params: PollVoteNotification[]): string {
    if (params.length == 0) {
      return `No poll vote data found`;
    }
    const contents = params.map((param) => {
      return `${this.pollVoteContentText(param)}

      `;
    });

    return `${this.pollVoteTitleText(params[0])}

${contents}
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
