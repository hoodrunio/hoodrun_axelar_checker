import { AppDb } from "@database/database";
import { AxelarRPCQueryService } from "@services/rest/AxelarRPCQueryService";
import { xSeconds } from "queue/jobHelper";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";
import { NewWsPollAndVoteDto } from "./dto/NewWsPollDtos";
import { handleBlockResultsForPoll } from "./handler/HandleBlockResultsForPoll";

const POLL_AND_VOTE_CHECKER_JOB = "PollAndVoteCheckerJob";

export const initPollAndVoteCheckerJobQueue = async () => {
  const pollAndVoteCheckerQueue =
    AppQueueFactory.createQueue<NewWsPollAndVoteDto>(POLL_AND_VOTE_CHECKER_JOB);

  pollAndVoteCheckerQueue.process(100, async (job) => {
    const axelarRpcQueryService = new AxelarRPCQueryService();
    const { axlStateRepo } = new AppDb();
    const chainLatestHeight =
      await axelarRpcQueryService.getLatestBlockHeight();
    const axlState = await axlStateRepo.getState();
    let stateLatestHeight = axlState?.latestHeight ?? 0;
    if (!axlState || axlState.latestHeight < 1) {
      await axlStateRepo.upsertState({
        latestHeight: chainLatestHeight,
        latestPollCheckHeight: 0,
      });
      return Promise.resolve();
    }

    try {
      await handleBlockResultsForPoll({
        startHeight: stateLatestHeight,
        endHeight: chainLatestHeight,
      });
    } catch (error) {
      console.error("Error in handleBlockResultsForPoll", error);
    }

    await axlStateRepo.updateLatestHeight(chainLatestHeight);

    return Promise.resolve();
  });
};

export const addPollAndVoteCheckerJob = () => {
  appJobProducer.addJob(
    POLL_AND_VOTE_CHECKER_JOB,
    {},
    {
      repeat: { every: xSeconds(6) },
    }
  );
};
