import appJobProducer from "@/queue/producer/AppJobProducer";
import AppQueueFactory from "@/queue/queue/AppQueueFactory";
import { Data } from "ws";
import { parseAxlEventMessageData } from "@/ws/client/helper";
import { IWsEventMessageTxResult } from "@/ws/interface/IWsEventMessageTx";
import { PollTxMessageResultHandler } from "@/ws/message/PollTxMessageResultHandler";
import { WsMessageTxResult } from "@/ws/message/WsMessageTxResult";
import { AmplifierEventHandler } from "@/ws/handlers/AmplifierEventHandler";
import { AppDb } from "@/database/database";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import axios from 'axios';
import appConfig from '@/config';
import { Queue, Job } from 'bull';

export const WS_MESSAGE_RESULT_HANDLER_QUEUE = "wsMessageResultHandlerQueue";
export interface IWsMessageDataType {
  messageData: Data;
}

class WsMessageResultHandlerQueueManager {
  private static instance: WsMessageResultHandlerQueueManager;
  private queue: Queue<IWsMessageDataType> | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): WsMessageResultHandlerQueueManager {
    if (!WsMessageResultHandlerQueueManager.instance) {
      WsMessageResultHandlerQueueManager.instance = new WsMessageResultHandlerQueueManager();
    }
    return WsMessageResultHandlerQueueManager.instance;
  }

  public async getQueue(): Promise<Queue<IWsMessageDataType>> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.queue) {
      await this.initQueue();
    }
    return this.queue!;
  }

  private async initQueue(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (this.isInitialized && this.queue) {
          try {
            await this.queue.getJobCounts();
            return;
          } catch (error) {
            logger.error('Queue check failed, reinitializing...', error);
            this.isInitialized = false;
            this.queue = null;
          }
        }

        this.queue = AppQueueFactory.createQueue<IWsMessageDataType>(
          WS_MESSAGE_RESULT_HANDLER_QUEUE,
          false
        );

        // Set a higher limit for listeners
        this.queue.setMaxListeners(50);

        const db = new AppDb();
        const axiosClient = axios.create({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });
        
        const queryService = new AmplifierQueryService(
          axiosClient,
          appConfig.mainnetAxelarLCDRestBaseUrls[0]
        );
        
        const amplifierHandler = new AmplifierEventHandler(db, queryService);

        // Add the processor
        this.queue.process(async (job: Job<IWsMessageDataType>) => {
          const messageData = job.data.messageData;
          const parsedData = parseAxlEventMessageData<IWsEventMessageTxResult>(messageData);

          if (!parsedData) return;

          const result = new WsMessageTxResult(parsedData.result);

          try {
            // Handle poll events
            new PollTxMessageResultHandler().handle(result);
            // Handle amplifier events
            await amplifierHandler.handleMessageResult(result);
          } catch (error) {
            logger.error('Error processing message:', error);
            throw error;
          }
        });

        // Add error handler
        this.queue.on('error', (error: Error) => {
          logger.error('Queue error:', error);
        });

        // Add stalled handler
        this.queue.on('stalled', (job: Job<IWsMessageDataType>) => {
          logger.warn('Job stalled:', job.id);
        });

        this.isInitialized = true;
        logger.info('WsMessageResultHandler queue initialized successfully');
      } catch (error) {
        logger.error('Error initializing WsMessageResultHandler queue:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }
}

// Singleton instance
const queueManager = WsMessageResultHandlerQueueManager.getInstance();

export const initWsMessageResultHandlerQueue = async () => {
  await queueManager.getQueue();
};

export const addWsMessageResultHandlerJob = async (data: IWsMessageDataType) => {
  const queue = await queueManager.getQueue();
  appJobProducer.addJob(WS_MESSAGE_RESULT_HANDLER_QUEUE, data);
};
