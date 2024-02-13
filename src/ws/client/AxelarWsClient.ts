import appConfig from "@config/index";
import { addWsMessageResultHandlerJob } from "queue/jobs/WsMessageHandler";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
} from "ws/event/PollSendEvent";

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
      addWsMessageResultHandlerJob({ messageData: event?.data });
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
