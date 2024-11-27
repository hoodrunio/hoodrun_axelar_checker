import appConfig from "@config/index";
import { logger } from "@utils/logger";
import { addWsMessageResultHandlerJob } from "@/queue/jobs/WsMessageResultHandler";
import appJobProducer from "@/queue/producer/AppJobProducer";
import { WebSocket } from "ws";
import {
  ActivePollEvents,
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
  private currentWsUrlIndex = 0;
  private readonly RECONNECT_BASE_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 300000; // 5 minutes
  private readonly NOTIFICATION_COOLDOWN = 360000; // 1 hour
  private lastNotificationTime = 0;
  private lastConnectedUrl: string | null = null;
  private totalReconnectAttempts = 0;
  private isPushNotificationMode = false;

  constructor() {
    super();
    this.evmWs = null;
    this.amplifierWs = null;
    this.connect();
  }

  private async connect() {
    if (mainnetAxelarWsUrls.length === 0) {
      logger.error('No WebSocket URLs configured');
      return;
    }

    const url = mainnetAxelarWsUrls[this.currentWsUrlIndex];
    
    // EVM WebSocket connection
    this.evmWs = new WebSocket(url, this.getWsOptions());
    this.initEvmWebSocketEvents();

    // Amplifier WebSocket connection
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
      
      // Send success notification if we were previously disconnected
      if (this.lastNotificationTime > 0) {
        this.queueConnectionNotification(
          `✅ WebSocket connection restored successfully\nURL: ${mainnetAxelarWsUrls[this.currentWsUrlIndex]}`
        );
      }
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

    this.evmWs.onclose = async (event) => {
      const errorCode = event.code;
      const errorReason = event.reason || 'Unknown reason';
      logger.error('Disconnected from Axelar EVM WebSocket:', { code: errorCode, reason: errorReason });
      
      if (this.evmRetryCount < this.MAX_RETRIES) {
        setTimeout(() => {
          if (!this.evmIsReconnecting) {
            this.reconnectEvmWs(errorCode, errorReason);
          }
        }, 1000);
      }
    };

    this.evmWs.onerror = (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error("EVM WebSocket error:", errorMessage);
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
  private async reconnectEvmWs(errorCode?: number, errorReason?: string) {
    if (this.evmIsReconnecting) return;
    
    try {
      this.evmIsReconnecting = true;
      this.evmRetryCount++;
      this.totalReconnectAttempts++;
      
      logger.info(`EVM WebSocket reconnection attempt ${this.evmRetryCount} (Total: ${this.totalReconnectAttempts})`);
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.RECONNECT_BASE_DELAY * Math.pow(2, this.evmRetryCount - 1),
        this.MAX_RECONNECT_DELAY
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const currentUrl = mainnetAxelarWsUrls[this.currentWsUrlIndex];
      
      // Try next URL after certain number of retries on current URL
      if (this.evmRetryCount >= 3) {
        this.evmRetryCount = 0; // Reset retry count for new URL
        this.currentWsUrlIndex = (this.currentWsUrlIndex + 1) % mainnetAxelarWsUrls.length;
        const nextUrl = mainnetAxelarWsUrls[this.currentWsUrlIndex];
        
        // If we've cycled through all URLs
        if (this.currentWsUrlIndex === 0 && this.totalReconnectAttempts >= mainnetAxelarWsUrls.length * 3) {
          this.isPushNotificationMode = true;
          await this.queueConnectionNotification(
            `❌ All WebSocket connection attempts failed.\n` +
            `Tried all URLs ${Math.floor(this.totalReconnectAttempts / mainnetAxelarWsUrls.length)} times.\n` +
            `Switching to push notification mode.\n` +
            `Last error: ${errorCode ? `Code ${errorCode}` : 'Unknown'} - ${errorReason || 'No details'}`
          );
          return;
        }
        
        if (nextUrl !== this.lastConnectedUrl) {
          await this.queueConnectionNotification(
            `⚠️ Switching to alternate WebSocket URL.\n` +
            `Previous: ${currentUrl}\n` +
            `New: ${nextUrl}\n` +
            `Attempt: ${Math.floor(this.totalReconnectAttempts / mainnetAxelarWsUrls.length) + 1}`
          );
        }
      }
      
      const url = mainnetAxelarWsUrls[this.currentWsUrlIndex];
      this.evmWs = new WebSocket(url, this.getWsOptions());
      this.initEvmWebSocketEvents();
      
    } catch (error) {
      logger.error('Error during EVM WebSocket reconnection:', error);
      this.handleReconnectionError(errorCode, errorReason);
    } finally {
      this.evmIsReconnecting = false;
    }
  }

  private async handleReconnectionError(errorCode?: number, errorReason?: string) {
    // Only switch to push notification mode if we've tried all URLs multiple times
    if (this.currentWsUrlIndex === 0 && this.totalReconnectAttempts >= mainnetAxelarWsUrls.length * 3) {
      this.isPushNotificationMode = true;
      await this.queueConnectionNotification(
        `❌ WebSocket connection failed after trying all URLs.\n` +
        `Tried each URL ${Math.floor(this.totalReconnectAttempts / mainnetAxelarWsUrls.length)} times.\n` +
        `Total attempts: ${this.totalReconnectAttempts}\n` +
        `Switching to push notification mode.\n` +
        `Last error: ${errorCode ? `Code ${errorCode}` : 'Unknown'} - ${errorReason || 'No details'}`
      );
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

      const url = mainnetAxelarWsUrls[this.currentWsUrlIndex];
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

  private async queueConnectionNotification(message: string) {
    try {
      const now = Date.now();
      const isSuccessNotification = message.startsWith('✅');
      const isFailureNotification = message.startsWith('❌');
      
      // Reset clock drift
      if (this.lastNotificationTime > now) {
        this.lastNotificationTime = 0;
      }
      
      const timeSinceLastNotification = now - this.lastNotificationTime;
      const currentUrl = mainnetAxelarWsUrls[this.currentWsUrlIndex];
      
      // Allow notifications to bypass cooldown if:
      // 1. It's a success notification
      // 2. It's a complete failure notification (push notification mode)
      // 3. We're connecting to a different URL than last time
      // 4. It's our first notification
      // 5. We've passed the cooldown period
      if (
        isSuccessNotification ||
        isFailureNotification ||
        currentUrl !== this.lastConnectedUrl ||
        this.lastNotificationTime === 0 ||
        timeSinceLastNotification >= this.NOTIFICATION_COOLDOWN
      ) {
        const wsStatus = this.evmWs?.readyState;
        const statusMap = {
          [WebSocket.CONNECTING]: 'CONNECTING',
          [WebSocket.OPEN]: 'CONNECTED',
          [WebSocket.CLOSING]: 'CLOSING',
          [WebSocket.CLOSED]: 'DISCONNECTED'
        };

        const jobData = {
          message,
          timestamp: new Date().toISOString(),
          currentUrl,
          retryCount: this.evmRetryCount,
          totalAttempts: this.totalReconnectAttempts,
          status: wsStatus !== undefined ? statusMap[wsStatus] : 'UNKNOWN',
          isPushNotificationMode: this.isPushNotificationMode,
          nextRetryTime: this.isPushNotificationMode ? null : new Date(now + this.NOTIFICATION_COOLDOWN).toISOString()
        };
        
        logger.info('Queueing WebSocket notification with data:', {
          ...jobData,
          cooldown: `${this.NOTIFICATION_COOLDOWN / 1000} seconds`,
          lastNotification: new Date(this.lastNotificationTime).toISOString(),
          wsReadyState: wsStatus
        });
        
        await appJobProducer.addJob(
          "websocketConnectionNotificationJob",
          jobData
        );
        
        // Update tracking variables after successful queue
        this.lastNotificationTime = now;
        if (isSuccessNotification) {
          this.lastConnectedUrl = currentUrl;
          this.isPushNotificationMode = false;
          this.totalReconnectAttempts = 0;
        }
        
        logger.info('Successfully queued WebSocket connection notification');
      } else {
        const timeLeft = Math.ceil((this.NOTIFICATION_COOLDOWN - timeSinceLastNotification) / 1000);
        logger.debug(`Skipping notification due to cooldown. Next notification in ${timeLeft} seconds`, {
          lastNotification: new Date(this.lastNotificationTime).toISOString(),
          cooldownPeriod: `${this.NOTIFICATION_COOLDOWN / 1000} seconds`,
          timeLeft: `${timeLeft} seconds`,
          wsReadyState: this.evmWs?.readyState
        });
      }
    } catch (error) {
      logger.error('Failed to queue connection notification:', error);
      // Only reset lastNotificationTime for non-network errors
      if (!(error instanceof Error && error.message.includes('ECONNREFUSED'))) {
        this.lastNotificationTime = 0;
      }
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