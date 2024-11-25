import appConfig from "@config/index";
import { logger } from "@utils/logger";
import { addWsMessageResultHandlerJob } from "@/queue/jobs/WsMessageResultHandler";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
  PollSendEvent,
} from "@/ws/event/PollSendEvent";
import { PollEvent } from "@/ws/event/eventHelper";
import { ActiveAmplifierEvents } from "@/ws/event/AmplifierEventHelper";
import { EventEmitter } from "events";

const { axelarVoterAddress: userVoterAddress, mainnetAxelarWsUrls } = appConfig;

export class AxelarWsClient extends EventEmitter {
  private evmWs: WebSocket | null;
  private amplifierWs: WebSocket | null;
  private readonly MAX_RETRIES = 5;
  private evmRetryCount = 0;
  private evmIsReconnecting = false;
  private amplifierRetryCount = 0;
  private amplifierIsReconnecting = false;

  constructor() {
    super();
    this.evmWs = null;
    this.amplifierWs = null;
    this.connect();
  }

  private connect() {
    const url = mainnetAxelarWsUrls[0];
    
    // EVM WebSocket bağlantısı
    this.evmWs = new WebSocket(url, this.getWsOptions());
    this.initEvmWebSocketEvents();

    // Amplifier WebSocket bağlantısı
    this.amplifierWs = new WebSocket(url, this.getWsOptions());
    this.initAmplifierWebSocketEvents();
  }

  private getWsOptions() {
    return {
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits",
      },
    };
  }

  private initEvmWebSocketEvents() {
    if (!this.evmWs) return;

    this.evmWs.onopen = (event) => {
      this.evmRetryCount = 0;
      this.evmIsReconnecting = false;
      logger.info("Connected to Axelar EVM WebSocket");
      super.emit("evm-connect", event);
      this.initEvmSubscriptions();
    };

    this.evmWs.onmessage = (event) => {
      try {
        // Quick check for subscription acknowledgment
        const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        if (message.id === '0' && Object.keys(message.result || {}).length === 0) {
          return; // Skip subscription acknowledgments
        }
        
        addWsMessageResultHandlerJob({ messageData: event?.data });
        super.emit('evm-message', event);
      } catch (error) {
        logger.error('Error in EVM message handler:', error);
      }
    };

    this.evmWs.onclose = (event) => {
      logger.error('Disconnected from Axelar EVM WebSocket:', event);
      
      if (this.evmRetryCount < this.MAX_RETRIES) {
        setTimeout(() => {
          if (!this.evmIsReconnecting) {
            this.reconnectEvmWs();
          }
        }, 1000);
      }
    };

    this.evmWs.onerror = (error) => {
      logger.error("EVM WebSocket error:", error);
      super.emit('evm-error', error);
    };
  }

  private initAmplifierWebSocketEvents() {
    if (!this.amplifierWs) return;

    this.amplifierWs.onopen = (event) => {
      logger.info("Connected to Axelar Amplifier WebSocket");
      this.initAmplifierSubscriptions();
      super.emit('amplifier-connect', event);
    };

    this.amplifierWs.onmessage = (event) => {
      try {
        // Quick check for subscription acknowledgment
        const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        if (message.id === '0' && Object.keys(message.result || {}).length === 0) {
          return; // Skip subscription acknowledgments
        }
        
        addWsMessageResultHandlerJob({ messageData: event?.data });
        super.emit('amplifier-message', event);
      } catch (error) {
        logger.error('Error in Amplifier message handler:', error);
      }
    };

    this.amplifierWs.onclose = () => {
      logger.info("Disconnected from Axelar Amplifier WebSocket");
      super.emit('amplifier-disconnect');
      this.reconnectAmplifierWs();
    };

    this.amplifierWs.onerror = (error) => {
      logger.error("Amplifier WebSocket error:", error);
      super.emit('amplifier-error', error);
    };
  }

  // EVM subscriptions
  private initEvmSubscriptions() {
    this.subscribeToPollEvents();
    this.subscribeToValidatorVoteEvents({
      voterAddress: userVoterAddress,
    });
  }

  private subscribeToPollEvents() {
    if (!this.evmWs) return;

    const pollSendEvents = [
      ActivePollEvents.ConfirmDeposit,
      ActivePollEvents.ConfirmERC20Deposit,
      ActivePollEvents.ConfirmGatewayTx,
      ActivePollEvents.ConfirmTransferKey,
    ];

    pollSendEvents.forEach((event) => {
      this.evmWs?.send(event.asWsSubscribeEventString());
    });
  }

  public subscribeToValidatorVoteEvents({
    voterAddress,
  }: {
    voterAddress: string;
  }) {
    if (!this.evmWs) return;

    const event = new PollSendEvent(PollEvent.Voted, {
      voterAddress,
    });
    this.evmWs.send(event.asWsSubscribeEventString(), (err) => {
      if (err) {
        logger.error(
          `Error on subscribe voter ws votes for ${voterAddress}`,
          err
        );
      }
    });
  }

  // Amplifier subscriptions
  private initAmplifierSubscriptions() {
    if (!this.amplifierWs) return;

    Object.values(ActiveAmplifierEvents).forEach(event => {
      this.amplifierWs?.send(event.asWsSubscribeEventString(), (err) => {
        if (err) {
          logger.error(
            `Error subscribing to amplifier event: ${event.constructor.name}`,
            err
          );
        }
      });
    });
  }

  // Reconnection logic
  private async reconnectEvmWs() {
    if (this.evmRetryCount >= this.MAX_RETRIES) {
      logger.error("Max retry attempts reached for EVM WebSocket");
      return;
    }

    if (this.evmIsReconnecting) return;
    
    try {
      this.evmIsReconnecting = true;
      this.evmRetryCount++;
      
      logger.info(`EVM WebSocket reconnection attempt ${this.evmRetryCount}`);
      
      const url = mainnetAxelarWsUrls[0];
      this.evmWs = new WebSocket(url, this.getWsOptions());
      this.initEvmWebSocketEvents();
      
    } catch (error) {
      logger.error('Error during EVM WebSocket reconnection:', error);
    } finally {
      this.evmIsReconnecting = false;
    }
  }

  private async reconnectAmplifierWs() {
    if (this.amplifierIsReconnecting) return;
    this.amplifierIsReconnecting = true;

    try {
      this.amplifierRetryCount++;

      if (this.amplifierRetryCount > this.MAX_RETRIES) {
        logger.error("Max retry attempts reached for Amplifier WebSocket");
        this.amplifierRetryCount = 0;
        this.amplifierIsReconnecting = false;
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, this.amplifierRetryCount), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const url = mainnetAxelarWsUrls[0];
      this.amplifierWs = new WebSocket(url, this.getWsOptions());
      this.initAmplifierWebSocketEvents();
      
    } catch (error) {
      logger.error(`Amplifier WebSocket reconnection attempt ${this.amplifierRetryCount} failed:`, error);
      if (this.amplifierRetryCount >= this.MAX_RETRIES) {
        logger.error("Max retry attempts reached for Amplifier WebSocket");
        this.amplifierRetryCount = 0;
      }
    } finally {
      this.amplifierIsReconnecting = false;
    }
  }

  // Cleanup method for tests
  public cleanup() {
    if (this.evmWs) {
      this.evmWs.close();
      this.evmWs = null;
    }
    if (this.amplifierWs) {
      this.amplifierWs.close();
      this.amplifierWs = null;
    }
    
    this.evmRetryCount = 0;
    this.evmIsReconnecting = false;
    this.amplifierRetryCount = 0;
    this.amplifierIsReconnecting = false;
  }
}