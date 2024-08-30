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
  private eventListeners: { [event: string]: Function[] } = {};

  constructor() {
    const url = mainnetAxelarWsUrls[0];
    // console.log(url);

    this.ws = new WebSocket(url, {
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "Sec-WebSocket-Extensions":
          "permessage-deflate; client_max_window_bits",
      },
    });
    this.initWebSocketEvents();
  }

  // New on method
  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  // Emit event method
  private emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners[event];
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  // Update WebSocket events
  private initWebSocketEvents() {
    this.ws.onopen = (params) => {
      console.log("connected to Axelar ws", params.target.url);
      this.initOnOpen();
      this.emit('connect', params);
    };

    this.ws.onmessage = (event) => {
      console.log('Message', event.data)
      addWsMessageResultHandlerJob({ messageData: event?.data });
      this.emit('message', event);
    };

    this.ws.onclose = () => {
      console.log("disconnected from Axelar ws");
      this.emit('disconnect');
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.emit('error', error);
    };
  }

  private initOnOpen() {
    this.subscribeAllEvents();
  }

  private subscribeAllEvents() {
    this.subscribeToPollEvents();
    this.subscribeToValidatorVoteEvents({
      voterAddress: userVoterAddress,
    });
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

  public subscribeToValidatorVoteEvents({
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