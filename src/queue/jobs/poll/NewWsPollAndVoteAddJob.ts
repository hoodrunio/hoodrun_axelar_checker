import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import {
  NewWsPollAndVoteDto,
  NewWsPollDataTypeEnum,
} from "./dto/NewWsPollDtos";
import { handleOnNewPollVote } from "./handler/HandleNewPollVote";
import { handleOnNewPoll } from "./handler/HandleOnNewPoll";

const NEW_WS_POLL_AND_VOTE_ADD_JOB = "newWsPollAndVoteAddJob";

export const initNewWsPollAndVoteJobAddQueue = async () => {
  const newWsPollAndVoteAddQueue =
    AppQueueFactory.createQueue<NewWsPollAndVoteDto>(
      NEW_WS_POLL_AND_VOTE_ADD_JOB
    );

  newWsPollAndVoteAddQueue.process(3000, async (job) => {
    try {
      const { type, data } = job.data;
      if (type === NewWsPollDataTypeEnum.NEW_POLL) {
        await handleOnNewPoll(data);
      } else if (type === NewWsPollDataTypeEnum.NEW_POLL_VOTE) {
        await handleOnNewPollVote(data);
      }
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
    }
  });
};

export const addNewWsPollAndVoteAddJob = (data: NewWsPollAndVoteDto) => {
  appJobProducer.addJob(NEW_WS_POLL_AND_VOTE_ADD_JOB, data);
};
