export class TgReply {
  startReply() {
    return `<b style="text-align:center"><strong>Welcome HoodRun Axelar Validator Checker</strong></b>`;
  }

  successFullAddOperatorAddress(operatorAddress: string) {
    return `Operator address ${operatorAddress} has been added to the chat`;
  }
}
