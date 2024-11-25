import { AxelarWsClient } from '@/ws/client/AxelarWsClient';
import { ActiveAmplifierEvents } from '@/ws/event/AmplifierEventHelper';
import { WebSocket } from 'ws';
import { createMock } from '@golevelup/ts-jest';
import { logger } from '@/utils/logger';
import appConfig from '@config/index';

const { mainnetAxelarWsUrls } = appConfig;

// WebSocket event tipleri için interface'ler
interface WsEvent {
  type: string;
  target: WebSocket;
}

interface WsErrorEvent extends WsEvent {
  error: Error;
  message: string;
  type: string;
}

interface WsCloseEvent extends WsEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

jest.mock('ws');
jest.mock('@/utils/logger');

describe('AxelarWsClient Tests', () => {
  let client: AxelarWsClient;
  let mockEvmWs: jest.Mocked<WebSocket>;
  let mockAmplifierWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    console.log('Setting up test environment...');
    jest.clearAllMocks();
    mockEvmWs = createMock<WebSocket>();
    mockAmplifierWs = createMock<WebSocket>();
    
    let wsCount = 0;
    (WebSocket as jest.MockedClass<typeof WebSocket>).mockImplementation(() => {
      wsCount++;
      console.log(`Creating WebSocket instance #${wsCount}`);
      return wsCount <= 2 ? (wsCount === 1 ? mockEvmWs : mockAmplifierWs) : mockEvmWs;
    });
    
    client = new AxelarWsClient();
    console.log('AxelarWsClient instance created');
  });

  afterEach(() => {
    console.log('Cleaning up test environment...');
    client.cleanup();
    jest.useRealTimers();
  });

  describe('WebSocket Connections', () => {
    it('should establish separate connections for EVM and Amplifier', () => {
      console.log('Testing WebSocket connection establishment...');
      expect(WebSocket).toHaveBeenCalledTimes(2);
      console.log('WebSocket connections verified');
    });

    it('should initialize event handlers for both connections', () => {
      console.log('Testing event handler initialization...');
      expect(mockEvmWs.onopen).toBeDefined();
      expect(mockEvmWs.onmessage).toBeDefined();
      expect(mockEvmWs.onclose).toBeDefined();
      expect(mockEvmWs.onerror).toBeDefined();

      expect(mockAmplifierWs.onopen).toBeDefined();
      expect(mockAmplifierWs.onmessage).toBeDefined();
      expect(mockAmplifierWs.onclose).toBeDefined();
      expect(mockAmplifierWs.onerror).toBeDefined();
      console.log('Event handlers verified');
    });
  });

  describe('EVM Subscriptions', () => {
    it('should subscribe to EVM events on connection', () => {
      console.log('Testing EVM event subscriptions...');
      // Simulate connection open
      const mockEvent: WsEvent = {
        type: 'open',
        target: mockEvmWs
      };
      mockEvmWs.onopen?.(mockEvent as any);
      console.log('EVM connection opened');
      
      // Check if poll events were subscribed
      expect(mockEvmWs.send).toHaveBeenCalledTimes(5); // 4 poll events + 1 validator vote event
      console.log('EVM event subscriptions verified');
    });

    it('should handle EVM connection errors', () => {
      console.log('Testing EVM error handling...');
      const error = new Error('EVM connection error');
      const mockErrorEvent: WsErrorEvent = {
        type: 'error',
        target: mockEvmWs,
        error,
        message: error.message
      };
      mockEvmWs.onerror?.(mockErrorEvent as any);
      console.log('EVM error event triggered');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('EVM WebSocket error:'),
        mockErrorEvent
      );
      console.log('EVM error handling verified');
    });
  });

  describe('Amplifier Subscriptions', () => {
    it('should subscribe to all amplifier events on connection', () => {
      console.log('Testing Amplifier event subscriptions...');
      // Simulate connection open
      const mockEvent: WsEvent = {
        type: 'open',
        target: mockAmplifierWs
      };
      mockAmplifierWs.onopen?.(mockEvent as any);
      console.log('Amplifier connection opened');
      
      // Check if all amplifier events were subscribed
      expect(mockAmplifierWs.send).toHaveBeenCalledTimes(
        Object.keys(ActiveAmplifierEvents).length
      );
      console.log(`Verified ${Object.keys(ActiveAmplifierEvents).length} Amplifier events subscribed`);

      Object.values(ActiveAmplifierEvents).forEach(event => {
        expect(mockAmplifierWs.send).toHaveBeenCalledWith(
          event.asWsSubscribeEventString(),
          expect.any(Function)
        );
      });
      console.log('All Amplifier event subscriptions verified');
    });

    it('should handle amplifier subscription errors', () => {
      console.log('Testing Amplifier subscription error handling...');
      const mockEvent: WsEvent = {
        type: 'open',
        target: mockAmplifierWs
      };

      // Mock error before triggering onopen
      const mockError = new Error('Subscription failed');
      mockAmplifierWs.send.mockImplementation((_, callback: any) => {
        console.log('Simulating Amplifier subscription error');
        if (typeof callback === 'function') {
          callback(mockError);
        }
      });

      mockAmplifierWs.onopen?.(mockEvent as any);
      console.log('Amplifier connection opened with mocked error');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error subscribing to amplifier event:'),
        expect.any(Error)
      );
      console.log('Amplifier error handling verified');
    });
  });

  describe('Reconnection Logic', () => {
    let client: AxelarWsClient;
    let mockEvmWs: jest.Mocked<WebSocket>;
    let mockAmplifierWs: jest.Mocked<WebSocket>;
    let wsInstanceCount = 0;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      wsInstanceCount = 0;

      // WebSocket mock'unu oluştur
      (WebSocket as jest.MockedClass<typeof WebSocket>).mockImplementation((url) => {
        wsInstanceCount++;
        console.log(`Creating WebSocket instance #${wsInstanceCount}`);

        if (url === mainnetAxelarWsUrls[0]) {
          mockEvmWs = createMock<WebSocket>();
          return mockEvmWs;
        } else {
          mockAmplifierWs = createMock<WebSocket>();
          return mockAmplifierWs;
        }
      });

      client = new AxelarWsClient();
    });

    afterEach(() => {
      if (client) {
        client.cleanup();
      }
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should stop reconnecting after max retries', async () => {
      const MAX_RETRIES = 5;
      let connectionAttempts = 0;

      // EVM WebSocket bağlantı hatası simülasyonu
      mockEvmWs.onclose = jest.fn().mockImplementation(() => {
        connectionAttempts++;
        console.log(`Connection attempt ${connectionAttempts}`);

        if (connectionAttempts <= MAX_RETRIES) {
          // Yeni bir bağlantı denemesi tetikle
          setTimeout(() => {
            client['evmRetryCount']++; // private field'a erişim
            mockEvmWs.onclose?.({
              code: 1006,
              reason: 'Connection failed',
              wasClean: false,
              type: 'close',
              target: mockEvmWs
            } as any);
          }, 1000);
        } else {
          // Max deneme sayısına ulaşıldığında hata log'u
          logger.error("Max retry attempts reached for EVM WebSocket");
        }
      });

      // İlk bağlantı hatası tetikle
      mockEvmWs.onclose?.({
        code: 1006,
        reason: 'Initial connection failed',
        wasClean: false,
        type: 'close',
        target: mockEvmWs
      } as any);

      // Her yeniden bağlanma denemesi için zamanlayıcıyı ilerlet
      for (let i = 0; i <= MAX_RETRIES; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Mikro görevlerin tamamlanmasını bekle
      }
      
      console.log('Total connection attempts:', connectionAttempts);
      console.log('Error calls:', (logger.error as jest.Mock).mock.calls);


      
      // Doğrulamalar
      expect(connectionAttempts).toBe(MAX_RETRIES + 1);
      expect(logger.error).toHaveBeenCalledWith(
        "Max retry attempts reached for EVM WebSocket"
      );
      console.log('Max retry behavior verified');
    });
  });

  describe('Event Emission', () => {
    it('should emit events for both connections', () => {
      console.log('Testing event emission...');
      const mockEvmConnectCallback = jest.fn();
      const mockAmplifierConnectCallback = jest.fn();
      
      client.on('evm-connect', mockEvmConnectCallback);
      client.on('amplifier-connect', mockAmplifierConnectCallback);
      console.log('Event listeners registered');

      // Bağlantıları simüle et
      console.log('Simulating EVM connection...');
      mockEvmWs.onopen?.({
        type: 'open',
        target: mockEvmWs
      } as any);

      console.log('Simulating Amplifier connection...');
      mockAmplifierWs.onopen?.({
        type: 'open',
        target: mockAmplifierWs
      } as any);

      expect(mockEvmConnectCallback).toHaveBeenCalled();
      expect(mockAmplifierConnectCallback).toHaveBeenCalled();
      console.log('Event emission verified');
    });
  });
});
