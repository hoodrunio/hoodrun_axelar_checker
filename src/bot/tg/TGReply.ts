export class TgReply {
  startReply() {
    return `<b style="text-align:center"><strong>Welcome HoodRun Axelar Validator Checker</strong></b>`;
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
