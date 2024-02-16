import { logger } from "@utils/logger";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import { Data } from "ws";
import {
  parseAxlEventMessageData,
  parseWsMessageEventData,
} from "ws/client/helper";
import { ActivePollEvents } from "ws/event/PollSendEvent";
import { IWsEventMessageTxResult } from "ws/interface/IWsEventMessageTx";
import { PollTxMessageResultHandler } from "ws/message/PollTxMessageResultHandler";
import { WsMessageTxResult } from "ws/message/WsMessageTxResult";

export const WS_MESSAGE_RESULT_HANDLER_QUEUE = "wsMessageResultHandlerQueue";
export interface IWsMessageDataType {
  messageData: Data;
}

const pollAndVotes: { [key: string]: { parts: string[]; votes: string[] } } =
  {};

export const initWsMessageResultHandlerQueue = async () => {
  const wsMessageResultHandlerQueue =
    AppQueueFactory.createQueue<IWsMessageDataType>(
      WS_MESSAGE_RESULT_HANDLER_QUEUE
    );

  wsMessageResultHandlerQueue.process(async (job) => {
    const messageData = job.data.messageData;
    const parsedData =
      parseAxlEventMessageData<IWsEventMessageTxResult>(messageData);

    if (!parsedData) {
      logger.error(`Error parsing message data ${messageData}`);
      return Promise.resolve();
    }
    const raw = messageData.toString();
    const result = new WsMessageTxResult(
      {
        ...parsedData.result,
      },
      messageData.toString()
    );

    const anyActivePollEvent = Object.values(ActivePollEvents).some((value) => {
      const eventString = `axelar.evm.v1beta1.${value.pollEvent}Started.participants`;
      return raw.includes(eventString);
    });

    if (anyActivePollEvent) {
      const messageAction = result.getEventByKey(`message.action`);
      const chain = result.getEventByKey(
        `axelar.evm.v1beta1.${messageAction}Started.chain`
      );
      const participantObj = result.getEventByKey(
        `axelar.evm.v1beta1.${messageAction}Started.participants`
      );

      if (!participantObj) {
        throw new Error("Missing participantObj");
      }

      const participant: { poll_id: string; participants: string[] } =
        JSON.parse(participantObj);

      pollAndVotes[participant.poll_id] = {
        parts: participant.participants,
        votes: [],
      };
    }

    if (raw.includes("axelar.vote.v1beta1.Voted.action")) {
      const pollId = result.getEventByKey("axelar.vote.v1beta1.Voted.poll");
      const voterAddress = result.getEventByKey(
        "axelar.vote.v1beta1.Voted.voter"
      );
      const pollState = result.getEventByKey("axelar.vote.v1beta1.Voted.state");

      if (!pollId || !voterAddress || !pollState) {
        throw new Error("Missing pollId, voterAddress, pollState");
      }

      pollAndVotes[pollId].votes.push(voterAddress);
    }

    Object.keys(pollAndVotes).forEach((pollId) => {
      const poll = pollAndVotes[pollId];
      console.log({
        pollId,
        partslength: poll.parts.length,
        votesLength: poll.votes.length,
      });
    });

    new PollTxMessageResultHandler().handle(result);

    return Promise.resolve();
  });
};

export const addWsMessageResultHandlerJob = (data: IWsMessageDataType) => {
  appJobProducer.addJob(WS_MESSAGE_RESULT_HANDLER_QUEUE, data);
};
