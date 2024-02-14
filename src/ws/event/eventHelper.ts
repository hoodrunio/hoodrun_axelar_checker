import { IncludedPollEvents } from "./PollSendEvent";

export enum PollEvent {
  ConfirmDeposit = "ConfirmDeposit",
  ConfirmDepositStarted = "ConfirmDepositStarted",
  ConfirmERC20Deposit = "ConfirmERC20Deposit",
  ConfirmTransferKey = "ConfirmTransferKey",
  ConfirmKeyTransferStarted = "ConfirmKeyTransferStarted",
  ConfirmGatewayTx = "ConfirmGatewayTx",
  ConfirmGatewayTxStarted = "ConfirmGatewayTxStarted",
  Voted = "Voted",
}
export const getStartedPollEvent = (event: IncludedPollEvents) => {
  switch (event) {
    case PollEvent.ConfirmDeposit:
      return PollEvent.ConfirmDepositStarted;
    case PollEvent.ConfirmERC20Deposit:
      return PollEvent.ConfirmDepositStarted;
    case PollEvent.ConfirmTransferKey:
      return PollEvent.ConfirmKeyTransferStarted;
    case PollEvent.ConfirmGatewayTx:
      return PollEvent.ConfirmGatewayTxStarted;
  }
};
export const createPollWsEventQuery = (
  action: PollEvent,
  participantEvent: PollEvent
) =>
  `tm.event='Tx' AND message.action='${action}' AND axelar.evm.v1beta1.${participantEvent}.participants CONTAINS 'participants'`;
export const createPollVoteWsEventQuery = (
  action: PollEvent,
  voterAddress?: string
) => {
  if (voterAddress) {
    const validatorVoteQuery = `tm.event='Tx' AND axelar.vote.v1beta1.${action}.action CONTAINS 'vote' AND axelar.vote.v1beta1.Voted.voter CONTAINS '${voterAddress}'`;
    return validatorVoteQuery;
  }
  const voteQuery = `tm.event='Tx' AND axelar.vote.v1beta1.${action}.action CONTAINS 'vote'`;
  return voteQuery;
};
