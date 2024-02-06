import { connectDb } from "@database/index";
import { AxelarQueryService } from "../services/rest/AxelarQueryService";
import { Validator } from "../services/rest/interfaces/validators/validator";
import { TGBot } from "bot/tg/TGBot";

class App {
  axelarQueryService: AxelarQueryService;
  env: string;

  constructor() {
    this.env = process.env.NODE_ENV ?? "development";

    this.axelarQueryService = new AxelarQueryService();
  }
  async initalizeApplication() {
    await this.initDbConn();
    await this.initTgBot();
  }

  private async initDbConn() {
    await connectDb(this.env);
  }

  private async initTgBot() {
    await TGBot.getInstance();
  }

  async getAxelarLatestValidators(): Promise<Validator[]> {
    try {
      const response = await this.axelarQueryService.getAllValidators();
      return response?.validators;
    } catch (error) {
      console.error(`Axelar Query Service getAllValidators failed: ${error}`);
      throw error;
    }
  }
}

export default App;
