import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import {
  NewWsPollAndVoteDto,
  NewWsPollDataTypeEnum,
  NewWsPollVoteDto,
} from "./dto/NewWsPollDtos";
import { logger } from "@utils/logger";
import { handleOnNewPoll } from "./handler/HandleOnNewPoll";
import { handleOnNewPollVote } from "./handler/HandleNewPollVote";

const NEW_WS_ALL_POLL_DATA_JOB = "NewWsAllPollDataJob";
const polls: { [key: string]: Omit<NewWsPollVoteDto, "vote">[] } = {};

export const initNewWsAllPollDataQueue = async () => {
  const newWsAllPollDataJobQueue =
    AppQueueFactory.createQueue<NewWsPollAndVoteDto>(NEW_WS_ALL_POLL_DATA_JOB);

  newWsAllPollDataJobQueue.process(4, async (job) => {
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
