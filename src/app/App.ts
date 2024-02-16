import { connectDb } from "@database/index";
import { TGBot } from "bot/tg/TGBot";
import { initWsMessageResultHandlerQueue } from "queue/jobs/WsMessageHandler";
import { initNewWsAllPollDataQueue } from "queue/jobs/poll/NewWsAllPollDataJob";
import {
  addPollVoteNotificationJob,
  initPollVoteNotificationQueue,
} from "queue/jobs/poll/notification/PollVoteNotificationJob";
import { addValAllInfoCheckerJob } from "queue/jobs/validators/ValAllInfoCheckerJob";
import { addValUptimeCheckerJob } from "queue/jobs/validators/ValUptimeCheckerJob";
import { AxelarWsClient } from "ws/client/AxelarWsClient";
import { AxelarQueryService } from "../services/rest/AxelarQueryService";

class App {
  axelarQueryService: AxelarQueryService;
  env: string;

  constructor() {
    this.env = process.env.NODE_ENV ?? "development";

    this.axelarQueryService = new AxelarQueryService();
  }
  async initalizeApplication() {
    await this.initDbConn();
    await this.initAxelarWS();
    await this.initTgBot();
    await this.initJobsAndQueues();
  }
  private async initAxelarWS() {
    new AxelarWsClient();
  }

  private async initDbConn() {
    await connectDb(this.env);
  }

  private async initTgBot() {
    await TGBot.getInstance();
  }
  private async initJobsAndQueues() {
    // //Init queues before jobs
    await this.initQueue();
    // ------------------------------ //
    await this.initJobs();
  }

  private async initQueue() {
    await initWsMessageResultHandlerQueue();
    await initNewWsAllPollDataQueue();
    await initPollVoteNotificationQueue();
  }

  private async initJobs() {
    addValAllInfoCheckerJob();
    addValUptimeCheckerJob();
    addPollVoteNotificationJob();
  }
}

export default App;
