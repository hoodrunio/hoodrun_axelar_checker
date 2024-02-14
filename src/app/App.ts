import { connectDb } from "@database/index";
import { TGBot } from "bot/tg/TGBot";
import { initWsMessageResultHandlerQueue } from "queue/jobs/WsMessageHandler";
import { initNewWsPollAndVoteJobAddQueue } from "queue/jobs/poll/NewWsPollAndVoteAddJob";
import {
  addValAllInfoCheckerJob,
  initValAllInfoCheckerQueue,
} from "queue/jobs/validators/ValAllInfoCheckerJob";
import {
  addValUptimeCheckerJob,
  initValsUptimeCheckerQueue,
} from "queue/jobs/validators/ValUptimeCheckerJob";
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
    await this.initAxelarWS();
    await this.initDbConn();
    // await this.initTgBot();

    // //Init queues before jobs
    await this.initQueue();
    // ------------------------------ //
    await this.initJobs();
  }
  private async initAxelarWS() {
    const _ = new AxelarWsClient();
  }

  private async initDbConn() {
    await connectDb(this.env);
  }

  private async initTgBot() {
    await TGBot.getInstance();
  }

  private async initQueue() {
    await initValAllInfoCheckerQueue();
    await initValsUptimeCheckerQueue();
    await initNewWsPollAndVoteJobAddQueue();
    await initWsMessageResultHandlerQueue();
  }

  private async initJobs() {
    addValAllInfoCheckerJob();
    addValUptimeCheckerJob();
  }
}

export default App;
