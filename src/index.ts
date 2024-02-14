import { AxelarQueryService } from "@services/rest/AxelarQueryService";
import App from "./app/App";
import { logger } from "./utils/logger";

import "@extensions/array.extensions";

logger.info("Starting bot...");

async function main() {
  try {
    const logExample = `[{\"log\":\"not enough votes to confirm poll 898838 yet\",\"events\":[{\"type\":\"axelar.vote.v1beta1.Voted\",\"attributes\":[{\"key\":\"action\",\"value\":\"\\\"vote\\\"\"},{\"key\":\"module\",\"value\":\"\\\"vote\\\"\"},{\"key\":\"poll\",\"value\":\"\\\"898838\\\"\"},{\"key\":\"state\",\"value\":\"\\\"POLL_STATE_PENDING\\\"\"},{\"key\":\"voter\",\"value\":\"\\\"axelar1zdkzmqvx0c57qg85gttv8dgd0y33jnkjttxqrn\\\"\"}]},{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"receiver\",\"value\":\"axelar1zdkzmqvx0c57qg85gttv8dgd0y33jnkjttxqrn\"},{\"key\":\"amount\",\"value\":\"3276uaxl\"}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"spender\",\"value\":\"axelar17xpfvakm2amg962yls6f84z3kell8c5l5h4gqu\"},{\"key\":\"amount\",\"value\":\"3276uaxl\"}]},{\"type\":\"message\",\"attributes\":[{\"key\":\"action\",\"value\":\"RefundMsgRequest\"},{\"key\":\"sender\",\"value\":\"axelar17xpfvakm2amg962yls6f84z3kell8c5l5h4gqu\"}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"recipient\",\"value\":\"axelar1zdkzmqvx0c57qg85gttv8dgd0y33jnkjttxqrn\"},{\"key\":\"sender\",\"value\":\"axelar17xpfvakm2amg962yls6f84z3kell8c5l5h4gqu\"},{\"key\":\"amount\",\"value\":\"3276uaxl\"}]}]}]`;

    const app = new App();
    await app.initalizeApplication();
  } catch (error) {
    logger.error(error);
  }

  logger.info("Application initialized");
}

main();
