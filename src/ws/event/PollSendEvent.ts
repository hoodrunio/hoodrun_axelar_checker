import { IWsSubscribeEventType } from "ws/interface/IWsSubscribeEvent";
import {
  PollEvent,
  createPollVoteWsEventQuery,
  createPollWsEventQuery,
  getStartedPollEvent,
} from "./eventHelper";

export class PollSendEvent {
  query: string = "";
  pollEvent: PollEvent;

  constructor(event: PollEvent, params?: { voterAddress: string }) {
    this.pollEvent = event;

    switch (event) {
      case PollEvent.ConfirmDeposit:
        this.query = createPollWsEventQuery(
          PollEvent.ConfirmDeposit,
          PollEvent.ConfirmDepositStarted
        );
        break;
      case PollEvent.ConfirmERC20Deposit:
        this.query = createPollWsEventQuery(
          PollEvent.ConfirmERC20Deposit,
          PollEvent.ConfirmDepositStarted
        );
        break;
      case PollEvent.ConfirmTransferKey:
        this.query = createPollWsEventQuery(
          PollEvent.ConfirmTransferKey,
          PollEvent.ConfirmKeyTransferStarted
        );
        break;
      case PollEvent.ConfirmGatewayTx:
        this.query = createPollWsEventQuery(
          PollEvent.ConfirmGatewayTx,
          PollEvent.ConfirmGatewayTxStarted
        );
        break;
      case PollEvent.Voted:
        this.query = createPollVoteWsEventQuery(
          PollEvent.Voted,
          params?.voterAddress
        );
        break;
    }
  }

  asWsSubscribeEvent(): IWsSubscribeEventType {
    return {
      jsonrpc: "2.0",
      method: "subscribe",
      id: "0",
      params: {
        query: `${this.query}`,
      },
    };
  }
  asWsSubscribeEventString(): string {
    return JSON.stringify(this.asWsSubscribeEvent());
  }

  getQuery(): string {
    return this.query;
  }

  axelarEvmVKeyWithSuffix(suffix?: string): string {
    const suffixRes = suffix ? `.${suffix}` : "";
    const started = getStartedPollEvent(this.pollEvent as IncludedPollEvents);
    return `axelar.evm.v1beta1.${started}${suffixRes}`;
  }
}

export type IncludedPollEvents =
  | PollEvent.ConfirmDeposit
  | PollEvent.ConfirmERC20Deposit
  | PollEvent.ConfirmGatewayTx
  | PollEvent.ConfirmTransferKey;

export const ActivePollEvents: { [key in IncludedPollEvents]: PollSendEvent } =
  {
    [PollEvent.ConfirmDeposit]: new PollSendEvent(PollEvent.ConfirmDeposit),
    [PollEvent.ConfirmERC20Deposit]: new PollSendEvent(
      PollEvent.ConfirmERC20Deposit
    ),
    [PollEvent.ConfirmGatewayTx]: new PollSendEvent(PollEvent.ConfirmGatewayTx),
    [PollEvent.ConfirmTransferKey]: new PollSendEvent(
      PollEvent.ConfirmTransferKey
    ),
  };

type IncludedPollVotedEvents = PollEvent.Voted;

export const ActivePollVotedEvents: {
  [key in IncludedPollVotedEvents]: PollSendEvent;
} = {
  [PollEvent.Voted]: new PollSendEvent(PollEvent.Voted),
};
