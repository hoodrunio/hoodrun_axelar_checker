import appConfig from "@config/index";
import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import { Bot, InlineKeyboard } from "grammy";
import { TgReply } from "./TGReply";
import { Commands, TgQuery } from "./constants";
import {
  eventBuilder,
  uptimeQueryBuilder,
  uptimeQueryExtractor,
} from "./helpers/tgQuery";
import { chatSaverMiddleware } from "./middlewares/chatSaverMiddleware";

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

        keyboard
          .text(
            `🚜 ${moniker} - ${operatorAddress}`,
            `${uptimeQueryBuilder(operatorAddress)}` // uptime:axelarvaloper1...
          )
          .row();
      }

      ctx.reply("*Validator List*", {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    });
  }

  private _uptimeValidatorCMD() {
    const event = eventBuilder(TgQuery.UpTime.prefix, TgQuery.UpTime.separator);
    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;

      const operatorAddressInput = uptimeQueryExtractor(input);

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
    this._initStartCMD();
    this._addOperatorAddressCMD();
    this._listValidatorsCMD();
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
