import { logger } from "@utils/logger";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import {
  NewWsPollAndVoteDto,
  NewWsPollDataTypeEnum,
} from "./dto/NewWsPollDtos";
import { handleOnNewPollVote } from "./handler/HandleNewPollVote";
import { handleOnNewPoll } from "./handler/HandleOnNewPoll";

const NEW_WS_ALL_POLL_DATA_JOB = "NewWsAllPollDataJob";

export const initNewWsAllPollDataQueue = async () => {
  const newWsAllPollDataJobQueue =
    AppQueueFactory.createQueue<NewWsPollAndVoteDto>(NEW_WS_ALL_POLL_DATA_JOB);

  newWsAllPollDataJobQueue.process(async (job) => {
    const { type, data } = job.data;

    if (type == NewWsPollDataTypeEnum.NEW_POLL) {
      try {
        await handleOnNewPoll(data);
      } catch (error) {
        logger.error("Error in handleOnNewPoll", error);
      }
    }

    if (type == NewWsPollDataTypeEnum.NEW_POLL_VOTE) {
      try {
        await handleOnNewPollVote(data);
      } catch (error) {
        logger.error("Error in handleOnNewPollVote", error);
      }
    }

    return Promise.resolve();
  });
};

export const addNewWsAllPollDataJob = (data: NewWsPollAndVoteDto) => {
  appJobProducer.addJob(NEW_WS_ALL_POLL_DATA_JOB, data);
};
