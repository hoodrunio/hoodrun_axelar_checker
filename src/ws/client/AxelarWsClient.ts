import appConfig from "@config/index";
import { IValidator } from "@database/models/validator/validator.interface";
import { addWsMessageResultHandlerJob } from "queue/jobs/WsMessageHandler";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
  PollSendEvent,
} from "ws/event/PollSendEvent";
import { PollEvent } from "ws/event/eventHelper";
export class AxelarWsClient {
  ws: WebSocket;
  constructor() {
    const url = appConfig.mainnetAxelarWsUrls[0];
    console.log(url);

    this.ws = new WebSocket(url, {
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "Sec-WebSocket-Extensions":
          "permessage-deflate; client_max_window_bits",
      },
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 5 * 1024,
          memLevel: 9,
          level: 8,
        },
        zlibInflateOptions: {
          chunkSize: 5 * 1024,
          memLevel: 9,
          level: 8,
        },

        concurrencyLimit: 2000,
      },
      maxPayload: 200 * 1024 * 1024,
    });
  }

  public async initializeListeners() {
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
    // this.subscribeAllEvents();
    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "subscribe",
        id: "0",
        params: { query: `tm.event='Tx'` },
      })
    );
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

  private subscribeToValidatorVoteEvents({
    voterAddress,
  }: {
    voterAddress: string;
  }) {
    const event = new PollSendEvent(PollEvent.Voted, {
      voterAddress,
    });

    this.ws.send(event.asWsSubscribeEventString(), (err) => {
      console.log(
        `Error on subscribe voter ws votes for ${voterAddress} `,
        err
      );
    });
  }
}
