import appConfig from "@config/index";
import { AppDb } from "@database/database";
import { logger } from "@utils/logger";
import BigNumber from "bignumber.js";
import { Bot, InlineKeyboard } from "grammy";
import { Commands } from "./constants";
import { TgQuery } from "./helpers/tgQuery";
import { elipsized } from "./helpers/validator";
import { chatSaverMiddleware } from "./middlewares/chatSaverMiddleware";
import {
  PollVoteNotification,
  UptimeNotification,
} from "./interface/notification";
import {
  INotification,
  NotificationEvent,
  PollVoteNotificationDataType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";
import { TgReply } from "./TGReply";

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

  public async sendMessageToUser(
    { chat_id }: { chat_id: number },
    message: string
  ) {
    try {
      await this.bot.api.sendMessage(chat_id, message, { parse_mode: "HTML" });
      logger.info(`Message sent to user ${chat_id}`);
    } catch (error) {
      logger.error(`Error while sending message to user ${chat_id}`, error);
    }
  }

  private async sendUptimeNotification<T extends UptimeNotification>(data: T) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.uptimeReply(data)
    );
  }

  private async sendPollVoteNotification<T extends PollVoteNotification>(
    data: PollVoteNotification
  ) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.pollVoteReply(data)
    );
  }

  public async sendNotification(notification: INotification) {
    const { data, event, recipient } = notification;
    const tgRecipient = parseInt(recipient);

    switch (event) {
      case NotificationEvent.UPTIME:
        await this.sendUptimeNotification({
          ...(data as UptimeNotificationDataType),
          chat_id: tgRecipient,
        });
        break;
      case NotificationEvent.POOL_VOTE:
        await this.sendPollVoteNotification({
          ...(data as PollVoteNotificationDataType),
          chat_id: tgRecipient,
        });
        break;
    }
  }

  // private _addOperatorAddressCMD() {
  //   const addAddressCommand = Commands.AddOperatorAddress;
  //   this.bot.command(addAddressCommand.command, async (ctx) => {
  //     const { message: { text } = {}, chat } = ctx;
  //     const valRepo = this.appDb.validatorRepository;
  //     const tgUserRepo = this.appDb.telegramUserRepo;

  //     const validMessage = addAddressCommand.validate(text ?? "");
  //     if (!validMessage) {
  //       ctx.reply(
  //         `Please use correct command format: ${addAddressCommand.command}`
  //       );
  //       return;
  //     }

  //     const operatorAddress = text?.split(" ")[1] as string;
  //     const existInDb = await valRepo.isOperatorExist(operatorAddress);
  //     if (!existInDb) {
  //       ctx.reply(
  //         `Operator address ${operatorAddress} does not exist in Network`
  //       );
  //       return;
  //     }

  //     try {
  //       await tgUserRepo.addOperatorAddressToChat({
  //         chat_id: chat?.id,
  //         operator_address: operatorAddress,
  //       });

  //       ctx.reply(this.tgReply.successFullAddOperatorAddress(operatorAddress), {
  //         parse_mode: "HTML",
  //       });
  //     } catch (error) {
  //       logger.error(error);
  //       ctx.reply("Error while adding operator address to chat");
  //     }
  //   });
  // }

  private _listValidatorsCMD() {
    const listValidatorsCommand = Commands.ListValidators;
    this.bot.command(listValidatorsCommand.command, async (ctx) => {
      const envValidator = await this.appDb.validatorRepository.findOne({
        voter_address: appConfig.axelarVoterAddress,
      });
      // const chatTgUser = await this.appDb.telegramUserRepo.findOne({
      //   chat_id: ctx.chat?.id ?? 0,
      // });
      // const operatorAdresses = chatTgUser?.operator_addresses ?? [];

      const operatorAdresses = [];

      if (envValidator) {
        operatorAdresses.push(envValidator.operator_address);
      }

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

      ctx.reply("📋 *Validator List*", {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    });
  }

  private _helpCMD() {
    this.bot.command("help", (ctx) => {
      ctx.reply(this.tgReply.startReply(), { parse_mode: "HTML" });
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

      const validator = await this.appDb.validatorRepository.findOne({
        operator_address: operatorAddressInput,
      });
      if (!validator) {
        ctx.reply("Invalid operator address");
        return;
      }

      const moniker = validator?.description.moniker ?? "";
      const operatorAddress = validator?.operator_address ?? "";
      const elipsizedOperatorAddress = elipsized(operatorAddress, 40);

      const keyboard = new InlineKeyboard();
      const uptimeButton = `🕒 Uptime`;
      const uptimeCallBackQueryData =
        TgQuery.UpTime.queryBuilder(operatorAddress);

      const evmSupprtedChainsButton = `⛓ Evm Supported Chains`;
      const evmSupChainsCallBackQueryData =
        TgQuery.EvmSupChains.queryBuilder(operatorAddress);

      const last30PollVoteButton = `🗳 Last 30 Poll Vote`;
      const last30PollVoteCallBackQueryData =
        TgQuery.Last30Votes.queryBuilder(operatorAddress);

      const rpcHealthButton = `🏥 RPC Health - Soon... 🫡`;
      const rpcHealthCallbackQueryData =
        TgQuery.RpcHealth.queryBuilder(operatorAddress);

      keyboard
        .text(uptimeButton, uptimeCallBackQueryData)
        .text(evmSupprtedChainsButton, evmSupChainsCallBackQueryData)
        .row()
        .text(last30PollVoteButton, last30PollVoteCallBackQueryData)
        .row()
        .text(rpcHealthButton, rpcHealthCallbackQueryData);

      ctx.reply(
        `🚜 *${moniker} ${elipsizedOperatorAddress} Validator Actions*`,
        {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        }
      );
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

      const uptime = validator?.uptime ?? 0.0;
      const moniker = validator?.description.moniker ?? "";
      const uptimeNotification: UptimeNotification = {
        operatorAddress: operatorAddressInput,
        currentUptime: uptime,
        threshold: 0,
        chat_id: ctx.chat?.id ?? 0,
        moniker,
      };
      ctx.reply(this.tgReply.uptimeReply(uptimeNotification), {
        parse_mode: "HTML",
      });
    });
  }

  private _last30PollVoteCMD() {
    const event = TgQuery.Last30Votes.event;
    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;
      console.log("input", input);

      const operatorAddressInput = TgQuery.Last30Votes.queryExtractor(input);

      if (!operatorAddressInput) {
        ctx.reply("Invalid operator address");
        return;
      }

      const { pollVoteRepo, validatorRepository } = new AppDb();
      const validator = await validatorRepository.findOne({
        operator_address: operatorAddressInput,
      });

      if (!validator) {
        ctx.reply("Invalid operator address");
        return;
      }

      const pollVotes = await pollVoteRepo.findAll({
        voter_address: validator.voter_address,
        limit: 30,
        sort: { createdAt: -1 },
      });

      const mappedPollVotes: PollVoteNotification[] = pollVotes.map(
        (pollVote) => ({
          chat_id: ctx.chat?.id ?? 0,
          operatorAddress: pollVote.voter_address,
          vote: pollVote.vote,
          pollId: pollVote.pollId,
          chain: pollVote.pollChain,
          moniker: validator.description.moniker,
        })
      );

      const reversed = mappedPollVotes.slice().reverse();

      const reply = this.tgReply.batchValidatorPollVoteReply(reversed);
      ctx.reply(reply, {
        parse_mode: "HTML",
      });
    });
  }
  private _rpcHealthCMD() {
    const event = TgQuery.RpcHealth.event;
    this.bot.callbackQuery(event, async (ctx) => {
      ctx.reply(
        "🙏 We're still brewing up Rpc Health feature like a secret potion... Stay tuned for the magic!"
      );
    });
  }

  private _initCMDS() {
    // Start Bot And Brief Introduction
    this._initStartCMD();

    // Add Operator Address
    // this._addOperatorAddressCMD();

    // Help
    this._helpCMD();

    // Validator List
    this._listValidatorsCMD();

    // Validator Actions
    this._showValidatorMenuCMD();
    this._evmSupportedChainsCMD();
    this._uptimeValidatorCMD();
    this._last30PollVoteCMD();
    this._rpcHealthCMD();
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
