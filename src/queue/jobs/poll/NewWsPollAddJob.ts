import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import { NewWsPollDto } from "./NewWsPollDto";

const NEW_WS_POLL_ADD_JOB = "newWsPollAddJob";

export const initNewWsPollAddQueue = async () => {
  const newWsPollAddQueue =
    AppQueueFactory.createQueue<NewWsPollDto>(NEW_WS_POLL_ADD_JOB);

  newWsPollAddQueue.process(async (job) => {
    const { pollChain, pollId, txHash, txHeight, participants, pollState } =
      job.data;
    const { pollRepo } = new AppDb();

    try {
      const poll = await pollRepo.upsertOne(
        { pollId },
        {
          pollId,
          pollChain,
          pollState,
          participants,
          txHash,
          txHeight,
        }
      );

      logger.info(`New poll added pollId: ${poll?.pollId}`);
    } catch (error) {
      logger.error(`Error adding new poll to db ${error}`);
    }
  });
};

export const addNewWsPollAddJob = async (data: NewWsPollDto) => {
  appJobProducer.addJob(NEW_WS_POLL_ADD_JOB, data);
};
