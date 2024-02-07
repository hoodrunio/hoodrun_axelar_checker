import appConfig from "@config/index";
import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import { Bot, InlineKeyboard } from "grammy";
import { TgReply } from "./TGReply";
import { Commands } from "./constants";
import { chatSaverMiddleware } from "./middlewares/chatSaverMiddleware";
import { TgQuery } from "./helpers/tgQuery";

export class TGBot {
  private static _instance: TGBot;
  bot: Bot;
  tgReply: TgReply;
  appDb: AppDb;

  private constructor({ token }: { token: string }) {
    this.bot = new Bot(token);
    this.tgReply = new TgReply();
    this.appDb = new AppDb();
  }

  public static async getInstance() {
    if (!TGBot._instance) {
      const _instance = new TGBot({ token: appConfig.tgToken });
      TGBot._instance = _instance;

      _instance.initCommands();
      _instance.appendBaseSubscribers();
      _instance.initBot();
    }

    return TGBot._instance;
  }

  private appendBaseSubscribers() {
    this._initMiddlewares();
    this._initCMDS();
  }

  private _addOperatorAddressCMD() {
    const addAddressCommand = Commands.AddOperatorAddress;
    this.bot.command(addAddressCommand.command, async (ctx) => {
      const { message: { text } = {}, chat } = ctx;
      const valRepo = this.appDb.validatorRepository;
      const tgUserRepo = this.appDb.telegramUserRepo;

      const validMessage = addAddressCommand.validate(text ?? "");
      if (!validMessage) {
        ctx.reply(
          `Please use correct command format: ${addAddressCommand.command}`
        );
        return;
      }

      const operatorAddress = text?.split(" ")[1] as string;
      const existInDb = await valRepo.isOperatorExist(operatorAddress);
      if (!existInDb) {
        ctx.reply(
          `Operator address ${operatorAddress} does not exist in Network`
        );
        return;
      }

      try {
        await tgUserRepo.addOperatorAddressToChat({
          chat_id: chat?.id,
          operator_address: operatorAddress,
        });

        ctx.reply(this.tgReply.successFullAddOperatorAddress(operatorAddress), {
          parse_mode: "HTML",
        });
      } catch (error) {
        logger.error(error);
        ctx.reply("Error while adding operator address to chat");
      }
    });
  }

  private _listValidatorsCMD() {
    const listValidatorsCommand = Commands.ListValidators;
    this.bot.command(listValidatorsCommand.command, async (ctx) => {
      const chatTgUser = await this.appDb.telegramUserRepo.findOne({
        chat_id: ctx.chat?.id ?? 0,
      });
      const operatorAdresses = chatTgUser?.operator_addresses ?? [];
      const keyboard = new InlineKeyboard();

      for (const operatorAddress of operatorAdresses) {
        let moniker = "Validator";
        try {
          const validator = await this.appDb.validatorRepository.findOne({
            operator_address: operatorAddress,
          });
          moniker = validator?.description.moniker ?? "";
        } catch (error) {
          logger.error(
            `While listing tg user validators moniker fetch ${error}`
          );
        }

        const buttonText = `🚜 ${moniker} | ${operatorAddress}`; // 🚜 HoodRun axelarvaloper1...
        const callBackQueryData =
          TgQuery.ValActions.queryBuilder(operatorAddress); // valActions:axelarvaloper1...

        keyboard.text(buttonText, callBackQueryData).row();
      }

      ctx.reply("*Validator List*", {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    });
  }

  private _showValidatorMenuCMD() {
    const event = TgQuery.ValActions.event;

    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;
      const operatorAddressInput = TgQuery.ValActions.queryExtractor(input);

      if (!operatorAddressInput) {
        ctx.reply("Invalid operator address");
        return;
      }

      console.log({ operatorAddressInput, input });

      const keyboard = new InlineKeyboard();
      const uptimeButton = `🕒 Uptime`;
      const uptimeCallBackQueryData =
        TgQuery.UpTime.queryBuilder(operatorAddressInput);

      const evmSupprtedChainsButton = `⛓ Evm Supprted Chains`;
      const evmSupChainsCallBackQueryData =
        TgQuery.EvmSupChains.queryBuilder(operatorAddressInput);

      keyboard
        .text(uptimeButton, uptimeCallBackQueryData)
        .text(evmSupprtedChainsButton, evmSupChainsCallBackQueryData);

      ctx.reply("*Validator Actions*", {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    });
  }

  private _evmSupportedChainsCMD() {
    const event = TgQuery.EvmSupChains.event;
    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;

      const operatorAddressInput = TgQuery.EvmSupChains.queryExtractor(input);

      if (!operatorAddressInput) {
        ctx.reply("Invalid operator address");
        return;
      }

      const validator = await this.appDb.validatorRepository.findOne({
        operator_address: operatorAddressInput,
      });

      if (!validator) {
        ctx.reply("Invalid operator address");
        return;
      }

      const upperCaseResult = validator?.supported_evm_chains.map((chain) =>
        chain.toUpperCase()
      );

      ctx.reply(this.tgReply.listMessage(upperCaseResult ?? []), {
        parse_mode: "HTML",
      });
    });
  }
  private _uptimeValidatorCMD() {
    const event = TgQuery.UpTime.event;
    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;

      const operatorAddressInput = TgQuery.UpTime.queryExtractor(input);

      if (!operatorAddressInput) {
        ctx.reply("Invalid operator address");
        return;
      }

      const validator = await this.appDb.validatorRepository.findOne({
        operator_address: operatorAddressInput,
      });

      const tempUptime = 0.99;
      const moniker = validator?.description.moniker ?? "";
      ctx.reply(
        `Uptime for ${moniker} - ${operatorAddressInput} is ${(
          tempUptime * 100
        ).toFixed(2)}%`
      );
    });
  }

  private _initCMDS() {
    // Start Bot And Brief Introduction
    this._initStartCMD();

    // Add Operator Address
    this._addOperatorAddressCMD();

    // Validator List
    this._listValidatorsCMD();

    // Validator Actions
    this._evmSupportedChainsCMD();
    this._showValidatorMenuCMD();
    this._uptimeValidatorCMD();
  }

  private _initStartCMD() {
    this.bot.command("start", (ctx) => {
      ctx.reply(this.tgReply.startReply(), { parse_mode: "HTML" });
    });
  }

  private _initMiddlewares() {
    const db = this.appDb;
    this.bot.use((ctx, next) => chatSaverMiddleware(ctx, next, db));
  }

  private async initCommands() {
    const commands = Object.values(Commands);
    await this.bot.api.setMyCommands(commands);
  }
  private async initBot() {
    await this.bot.start();
  }
}
