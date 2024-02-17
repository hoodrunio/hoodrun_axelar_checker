import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import { Data } from "ws";
import { parseAxlEventMessageData } from "ws/client/helper";
import { IWsEventMessageTxResult } from "ws/interface/IWsEventMessageTx";
import { PollTxMessageResultHandler } from "ws/message/PollTxMessageResultHandler";
import { WsMessageTxResult } from "ws/message/WsMessageTxResult";

export const WS_MESSAGE_RESULT_HANDLER_QUEUE = "wsMessageResultHandlerQueue";
export interface IWsMessageDataType {
  messageData: Data;
}

export const initWsMessageResultHandlerQueue = async () => {
  const wsMessageResultHandlerQueue =
    AppQueueFactory.createQueue<IWsMessageDataType>(
      WS_MESSAGE_RESULT_HANDLER_QUEUE
    );

  wsMessageResultHandlerQueue.process(async (job) => {
    const messageData = job.data.messageData;
    const parsedData =
      parseAxlEventMessageData<IWsEventMessageTxResult>(messageData);

    if (!parsedData) return;

    const result = new WsMessageTxResult(parsedData.result);
    const { txRepo } = new AppDb();

    try {
      await txRepo.create({
        height: parseInt(result.data.value.height),
        tx_raw: JSON.stringify(parsedData),
      });
    } catch (error) {
      logger.error("Error creating tx", error);
    }

    // new PollTxMessageResultHandler().handle(result);

    return Promise.resolve();
  });
};

export const addWsMessageResultHandlerJob = (data: IWsMessageDataType) => {
  appJobProducer.addJob(WS_MESSAGE_RESULT_HANDLER_QUEUE, data);
};
