import { connectDb } from "@database/index";
import { AxelarQueryService } from "../services/rest/AxelarQueryService";
import { Validator } from "../services/rest/interfaces/validators/validator";
import { TGBot } from "bot/tg/TGBot";
import { logger } from "@utils/logger";
import { AppDb } from "@database/database";
import { addValUptimeCheckerJob } from "queue/jobs/validators/ValUptimeJob";

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
    await this.initJobs();
  }

  private async initDbConn() {
    await connectDb(this.env);
  }

  private async initTgBot() {
    await TGBot.getInstance();
  }

  private async initJobs() {
    addValUptimeCheckerJob();
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

  async updateValidatorSupportedChains() {
    const db = new AppDb();
    const validators = await db.validatorRepository.findAll();
    const chainsMaintainers =
      await this.axelarQueryService.getAxelarAllEvmChainsWithMaintainers();

    const promises = validators.map(async (validator) => {
      const valSupportedChains: string[] = [];
      const operatorAddress = validator.operator_address;

      for (const [chain, maintainers] of chainsMaintainers.entries()) {
        if (maintainers.includes(operatorAddress)) {
          valSupportedChains.push(chain);
        }
      }

      try {
        await db.validatorRepository.updateValidatorSupportedEvmChains(
          operatorAddress,
          valSupportedChains
        );
      } catch (error) {
        logger.error(
          `Something went wrong while updating validator supported evm chains. Error: ${error}`
        );
      }
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      logger.error(
        `Something went wrong while running concurrent supported evm chains Promisses. Error: ${error}`
      );
    }
  }
}

export default App;
