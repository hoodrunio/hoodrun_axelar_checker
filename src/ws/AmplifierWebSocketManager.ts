import WebSocket from 'ws';
import { AMPLIFIER_CONFIG } from '@/config/amplifier.config';
import { AmplifierEventHandler } from './handlers/AmplifierEventHandler';
import { logger } from '@/utils/logger';
export class AmplifierWebSocketManager {
  private ws!: WebSocket;
  private eventHandler: AmplifierEventHandler;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(eventHandler: AmplifierEventHandler) {
    this.eventHandler = eventHandler;
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    this.ws = new WebSocket(`${AMPLIFIER_CONFIG.BASE_RPC_URL}/websocket`);

    this.ws.on('open', () => {
      logger.info('Amplifier WebSocket connected');
      this.subscribeToEvents();
    });

    this.ws.on('message', async (data: WebSocket.Data) => {
      try {
        const parsedData = JSON.parse(data.toString());
        if (parsedData.result?.events) {
          await this.eventHandler.handleEvent(parsedData.result.events);
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      logger.warn('Amplifier WebSocket disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('Amplifier WebSocket error:', error);
      this.ws.close();
    });
  }

  private subscribeToEvents() {
    const subscriptions = [
      {
        query: "tm.event='Tx' AND wasm-messages_poll_started"
      },
      {
        query: "tm.event='Tx' AND wasm-signing_started"
      }
    ];

    subscriptions.forEach(sub => {
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        id: `amplifier-${Date.now()}`,
        params: sub
      }));
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      logger.info('Attempting to reconnect Amplifier WebSocket...');
      this.initializeWebSocket();
    }, AMPLIFIER_CONFIG.WS_RECONNECT_INTERVAL);
  }

  public close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws.close();
  }
} 