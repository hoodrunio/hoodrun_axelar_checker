import appConfig from "@config/index";
import { logger } from "@utils/logger";
import { addWsMessageResultHandlerJob } from "queue/jobs/WsMessageResultHandler";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
  PollSendEvent,
} from "ws/event/PollSendEvent";
import { PollEvent } from "ws/event/eventHelper";

const { axelarVoterAddress: userVoterAddress, mainnetAxelarWsUrls } = appConfig;

export class AxelarWsClient {
  ws: WebSocket;
  constructor() {
    const url = mainnetAxelarWsUrls[0];
    console.log(url);

    this.ws = new WebSocket(url, {
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "Sec-WebSocket-Extensions":
          "permessage-deflate; client_max_window_bits",
      },
    });
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
    this.subscribeToAllTxEvents();
    // this.subscribeToPollEvents();
    // this.subscribeToValidatorVoteEvents({
    //   voterAddress: userVoterAddress,
    // });
  }
  private subscribeToAllTxEvents() {
    const txEvent = {
      jsonrpc: "2.0",
      method: "subscribe",
      id: "0",
      params: {
        query: `tm.event='Tx'`,
      },
    };
    this.ws.send(JSON.stringify(txEvent));
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

  private subscribeToValidatorVoteEvents({
    voterAddress,
  }: {
    voterAddress: string;
  }) {
    const event = new PollSendEvent(PollEvent.Voted, {
      voterAddress,
    });
    this.ws.send(event.asWsSubscribeEventString(), (err) => {
      if (err) {
        logger.error(
          `Error on subscribe voter ws votes for ${voterAddress} `,
          err
        );
      }
    });
  }
}
