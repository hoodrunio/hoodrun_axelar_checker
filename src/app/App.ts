import { connectDb } from "src/database";
import { AxelarQueryService } from "../services/rest/AxelarQueryService";
import { Validator } from "../services/rest/interfaces/validators/validator";

class App {
  axelarQueryService: AxelarQueryService;
  env: string;

  constructor() {
    this.env = process.env.NODE_ENV || "development";

    this.axelarQueryService = new AxelarQueryService();
    this.initalizeApplication();
  }
  private async initalizeApplication() {
    await this.initDbConn();
  }

  private async initDbConn() {
    await connectDb(this.env);
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
