import { TGBot } from "@/bot/tg/TGBot";
import { initWsMessageResultHandlerQueue } from "@/queue/jobs/WsMessageResultHandler";
import {
  initSendNotificationsQueue,
  addSendNotificationsJob,
} from "@/queue/jobs/notification/SendNotifications";
import { initNewWsAllPollDataQueue } from "@/queue/jobs/poll/NewWsAllPollDataJob";
import {
  initPollVoteNotificationQueue,
  addPollVoteNotificationJob,
} from "@/queue/jobs/poll/notification/PollVoteNotificationJob";
import {
  initValAllInfoCheckerQueue,
  addValAllInfoCheckerJob,
} from "@/queue/jobs/validators/ValAllInfoCheckerJob";
import {
  initValsUptimeCheckerQueue,
  addValUptimeCheckerJob,
} from "@/queue/jobs/validators/ValUptimeCheckerJob";
import { AxelarQueryService } from "@/services/rest/AxelarQueryService";
import { AxelarWsClient } from "@/ws/client/AxelarWsClient";
import { connectDb } from "@database/index";

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
    await initValAllInfoCheckerQueue();
    await initValsUptimeCheckerQueue();
    await initPollVoteNotificationQueue();

    await initSendNotificationsQueue();
    await initWsMessageResultHandlerQueue();
    await initNewWsAllPollDataQueue();
  }

  private async initJobs() {
    await addSendNotificationsJob();
    addValAllInfoCheckerJob();
    addValUptimeCheckerJob();
    addPollVoteNotificationJob();
  }
}

export default App;
