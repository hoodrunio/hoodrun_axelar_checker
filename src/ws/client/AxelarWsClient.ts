import appConfig from "@config/index";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
} from "ws/event/PollSendEvent";
import { IWsEventMessageTxResult } from "ws/interface/IWsEventMessageTx";
import { PollTxMessageResultHandler } from "ws/message/PollTxMessageResultHandler";
import { WsMessageTxResult } from "ws/message/WsMessageTxResult";
import { parseAxlEventMessage } from "./helper";

export class AxelarWsClient {
  ws: WebSocket;
  constructor() {
    const url = appConfig.mainnetAxelarWsUrls[0];
    console.log(url);

    this.ws = new WebSocket(url);
    this.ws.onopen = (params) => {
      console.log("connected to Axelar ws", params.target.url);
      this.initOnOpen();
    };

    this.ws.onmessage = (event) => {
      const messageData = parseAxlEventMessage<IWsEventMessageTxResult>(event);

      if (!messageData) return;

      const pollTxHandler = new PollTxMessageResultHandler();
      const result = new WsMessageTxResult(messageData.result);
      pollTxHandler.handle(result);
    };

    this.ws.onclose = () => {
      console.log("disconnected from Axelar ws");
    };
  }

  private initOnOpen() {
    this.subscribeAllEvents();
  }

  private subscribeAllEvents() {
    this.subscribeToPollEvents();
    this.subscribeToPollVoteEvent();
  }
  private subscribeToPollEvents() {
    const pollSendEvents = [
      ActivePollEvents.ConfirmDeposit,
      ActivePollEvents.ConfirmERC20Deposit,
      ActivePollEvents.ConfirmGatewayTx,
      ActivePollEvents.ConfirmTransferKey,
    ];

    pollSendEvents.forEach((event) => {
      this.ws.send(event.asWsSubscribeEventString());
    });
  }
  private subscribeToPollVoteEvent() {
    this.ws.send(ActivePollVotedEvents.Voted.asWsSubscribeEventString());
  }
}
