import { TgReply } from "@/bot/tg/TGReply";
import { Commands } from "@/bot/tg/constants";
import { TgQuery } from "@/bot/tg/helpers/tgQuery";
import { elipsized } from "@/bot/tg/helpers/validator";
import {
  EvmSupprtedChainRegistrationNotification,
  PollVoteNotification,
  RpcEndpointHealthNotification,
  UptimeNotification,
} from "@/bot/tg/interface/notification";
import { chatSaverMiddleware } from "@/bot/tg/middlewares/chatSaverMiddleware";
import appConfig from "@config/index";
import { AppDb } from "@database/database";
import {
  AmplifierSignatureNotificationDataType,
  AmplifierVoteNotificationDataType,
  BroadcasterBalanceLowNotificationDataType,
  ChainRegistrationStatus,
  INotification,
  NotificationEvent,
  PollVoteNotificationDataType,
  RpcEndpointHealthNotificationDataType,
  UptimeNotificationDataType,
} from "@database/models/notification/notification.interface";
import { logger } from "@utils/logger";
import { Bot, InlineKeyboard } from "grammy";
import { IAmplifierPoll } from "@database/models/amplifier/poll.interface";
import { IAmplifierSignature } from "@database/models/amplifier/signature.interface";
export class TGBot {
  private static _instance: TGBot | null = null;
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
      // Add retry mechanism in case of error
      await this.retryMessageSend(chat_id, message, 3); // Try 3 times
    }
  }

  private async retryMessageSend(chat_id: number, message: string, retries: number) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.bot.api.sendMessage(chat_id, message, { parse_mode: "HTML" });
        logger.info(`Message sent to user ${chat_id} after retry`);
        return;
      } catch (error) {
        logger.error(`Retry ${i + 1} failed for user ${chat_id}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
      }
    }
    logger.error(`Failed to send message to user ${chat_id} after ${retries} retries`);
  }

  private async sendUptimeNotification<T extends UptimeNotification>(data: T) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.uptimeReply(data)
    );
  }

  private async sendPollVoteNotification<T extends PollVoteNotification>(
    data: T
  ) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.pollVoteReply(data)
    );
  }

  private async sendRpcHealthNotif<T extends RpcEndpointHealthNotification>(
    data: T
  ) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.rpcEndpointHealthReply(data)
    );
  }

  private async sendEvmSupChainNotif<
    T extends EvmSupprtedChainRegistrationNotification
  >(data: T) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.evmSupportedChainReply(data)
    );
  }

  private async sendBroadcasterBalanceLowNotification<T extends BroadcasterBalanceLowNotificationDataType & { chat_id: number }>(data: T) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.broadcasterBalanceLowReply(data)
    );
  }

  private async sendAmplifierVoteNotification(data: AmplifierVoteNotificationDataType & { chat_id: number }) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.amplifierVoteReply(data)
    );
  }

  private async sendAmplifierSignatureNotification(data: AmplifierSignatureNotificationDataType & { chat_id: number }) {
    await this.sendMessageToUser(
      { chat_id: data.chat_id },
      this.tgReply.amplifierSignatureReply(data)
    );
  }

  public async sendNotification(
    notification: INotification
  ): Promise<{ sentSuccess: boolean }> {
    const { data, event, recipient } = notification;
    const tgRecipient = parseInt(recipient);
    let sentSuccess = false;

    switch (event) {
      case NotificationEvent.UPTIME:
        await this.sendUptimeNotification({
          ...(data as UptimeNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.POOL_VOTE:
        await this.sendPollVoteNotification({
          ...(data as PollVoteNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.RPC_ENDPOINT_HEALTH:
        await this.sendRpcHealthNotif({
          ...(data as RpcEndpointHealthNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.EVM_SUPPORTED_CHAIN_REGISTRATION:
        await this.sendEvmSupChainNotif({
          ...(data as EvmSupprtedChainRegistrationNotification),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.BROADCASTER_BALANCE_LOW:
        await this.sendBroadcasterBalanceLowNotification({
          ...(data as BroadcasterBalanceLowNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.AMPLIFIER_VOTE:
        await this.sendAmplifierVoteNotification({
          ...(data as AmplifierVoteNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
      case NotificationEvent.AMPLIFIER_SIGNATURE:
        await this.sendAmplifierSignatureNotification({
          ...(data as AmplifierSignatureNotificationDataType),
          chat_id: tgRecipient,
        });
        sentSuccess = true;
        break;
    }

    return Promise.resolve({ sentSuccess });
  }

  private _listValidatorsCMD() {
    const listValidatorsCommand = Commands.ListValidators;
    this.bot.command(listValidatorsCommand.command, async (ctx) => {
      const envValidator = await this.appDb.validatorRepository.findOne({
        voter_address: appConfig.axelarVoterAddress,
      });

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
    const helpCommand = Commands.Help;

    this.bot.command(helpCommand.command, (ctx) => {
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

      const rpcHealthButton = `🏥 RPC Endpoints Health`;
      const rpcHealthCallbackQueryData =
        TgQuery.RpcHealth.queryBuilder(operatorAddress);

      const amplifierPollsButton = `📊 Amplifier Polls`;
      const amplifierPollsCallBackQueryData =
        TgQuery.AmplifierPolls.queryBuilder(operatorAddress);

      const amplifierSignaturesButton = `✍️ Amplifier Signatures`;
      const amplifierSignaturesCallBackQueryData =
        TgQuery.AmplifierSigs.queryBuilder(operatorAddress);

      keyboard
        .text(uptimeButton, uptimeCallBackQueryData)
        .text(evmSupprtedChainsButton, evmSupChainsCallBackQueryData)
        .row()
        .text(last30PollVoteButton, last30PollVoteCallBackQueryData)
        .row()
        .text(rpcHealthButton, rpcHealthCallbackQueryData)
        .row()
        .text(amplifierPollsButton, amplifierPollsCallBackQueryData)
        .row()
        .text(amplifierSignaturesButton, amplifierSignaturesCallBackQueryData);

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
      const mappedRegisteredEvmSupportedChains: EvmSupprtedChainRegistrationNotification[] =
        upperCaseResult?.map((el) => ({
          chat_id: ctx.chat?.id ?? 0,
          chain: el,
          moniker: validator.description.moniker,
          operatorAddress: validator.operator_address,
          status: ChainRegistrationStatus.REGISTERED,
        }));

      ctx.reply(
        this.tgReply.evmSupportedChainBatchReply(
          mappedRegisteredEvmSupportedChains
        ),
        {
          parse_mode: "HTML",
        }
      );
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
      const input = ctx.update.callback_query?.data;
      const operatorAddressInput = TgQuery.RpcHealth.queryExtractor(input);
      if (!operatorAddressInput) {
        ctx.reply("Invalid operator address");
        return;
      }

      const { validatorRepository } = new AppDb();
      const validator = await validatorRepository.findOne({
        operator_address: operatorAddressInput,
      });

      if (!validator) {
        ctx.reply("Invalid operator address");
        return;
      }

      const endpoints = validator?.rpc_health_endpoints ?? [];
      const mappedRpcHealthEndpoints: RpcEndpointHealthNotification[] =
        endpoints
          .map((rpcEndpointEl) => ({
            chat_id: ctx.chat?.id ?? 0,
            rpcEndpoint: rpcEndpointEl.rpcEndpoint,
            isHealthy: rpcEndpointEl.isHealthy,
            name: rpcEndpointEl.name,
            moniker: validator.description.moniker,
            operatorAddress: validator.operator_address,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

      ctx.reply(
        this.tgReply.rpcEndpointHealthBatchReply(mappedRpcHealthEndpoints),
        {
          parse_mode: "HTML",
        }
      );
    });
  }

  private async _amplifierPollsCMD() {
    const event = TgQuery.AmplifierPolls.event;
  
    this.bot.callbackQuery(event, async (ctx) => {
      const input = ctx.update.callback_query?.data;
      const operatorAddress = TgQuery.AmplifierPolls.queryExtractor(input);
  
      if (!operatorAddress) {
        ctx.reply("Invalid operator address");
        return;
      }
  
      const validator = await this.appDb.validatorRepository.findOne({
        operator_address: operatorAddress,
      });
  
      if (!validator) {
        ctx.reply("Invalid operator address");
        return;
      }
  
      // Only show amplifier polls if this validator matches our monitored voter address
      if (validator.voter_address !== appConfig.axelarVoterAddress) {
        ctx.reply("This validator is not configured for amplifier monitoring");
        return;
      }
  
      console.log('Monitored verifiers:', appConfig.monitoredVerifiers);
      
      // Use the monitored verifiers from config
      const verifier = appConfig.monitoredVerifiers[0];
      console.log('Searching for verifier:', verifier);
      
      // Get all polls and filter in memory
      const pollModel = this.appDb.amplifierPollRepo.getModel();
      const allPolls = await pollModel.find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .exec();

      console.log('Total polls found:', allPolls.length);
      
      // Filter polls that have our verifier
      const polls = allPolls.filter(poll => 
        poll.participants.includes(verifier) || 
        poll.votes.some(vote => vote.voter === verifier)
      ).slice(0, 10);

      console.log('Filtered polls:', polls.length);

      if (!polls || polls.length === 0) {
        ctx.reply("No recent amplifier polls found for the monitored verifiers");
        return;
      }
  
      // Format the poll data
      const pollsText = polls.map((poll: IAmplifierPoll) => {
        const verifierVotes = poll.votes.filter(v => appConfig.monitoredVerifiers.includes(v.voter));
        const timestamp = poll.createdAt ? poll.createdAt : new Date();
const date = new Date(timestamp).toLocaleString();
        const votesSummary = verifierVotes.map(v => `${v.voter.slice(-4)}: ${v.vote}`).join(', ');
        return `Poll ID: ${poll.pollId}\nChain: ${poll.sourceChain}\nVotes: ${votesSummary}\nTime: ${date}\n`;
      }).join('\n');
  
      ctx.reply(`📊 Last 10 Amplifier Polls for ${validator.description.moniker}'s Verifiers:\n\n${pollsText}`, {
        parse_mode: "HTML"
      });
    });
  }

  private async _amplifierSignaturesCMD() {
  const event = TgQuery.AmplifierSigs.event;

  this.bot.callbackQuery(event, async (ctx) => {
    const input = ctx.update.callback_query?.data;
    const operatorAddress = TgQuery.AmplifierSigs.queryExtractor(input);

    if (!operatorAddress) {
      ctx.reply("Invalid operator address");
      return;
    }

    const validator = await this.appDb.validatorRepository.findOne({
      operator_address: operatorAddress,
    });

    if (!validator) {
      ctx.reply("Invalid operator address");
      return;
    }

    // Only show amplifier signatures if this validator matches our monitored voter address
    if (validator.voter_address !== appConfig.axelarVoterAddress) {
      ctx.reply("This validator is not configured for amplifier monitoring");
      return;
    }

    console.log('Looking for signatures...');
      
    // Use the monitored verifiers from config
    const verifier = appConfig.monitoredVerifiers[0];
    console.log('Searching for verifier:', verifier);
      
    // Get all signatures and filter in memory
    const sigModel = this.appDb.amplifierSignatureRepo.getModel();
    const allSessions = await sigModel.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    console.log('Total sessions found:', allSessions.length);
      
    // Filter sessions that have our verifier
    const sessions = allSessions.filter(session => 
      session.pubKeys.some(key => key.address === verifier) ||
      session.signatures.some(sig => sig.verifier === verifier)
    ).slice(0, 10);

    console.log('Filtered sessions:', sessions.length);

    if (!sessions || sessions.length === 0) {
      ctx.reply("No recent signature sessions found for the monitored verifiers");
      return;
    }

    // Format the signature session data
    const sessionsText = sessions.map((session: IAmplifierSignature) => {
      const verifierSignatures = session.signatures.filter(s => appConfig.monitoredVerifiers.includes(s.verifier));
      // Use current time as fallback if createdAt is undefined
      const timestamp = session.createdAt ? session.createdAt : new Date();
      const date = new Date(timestamp).toLocaleString();
      const signaturesSummary = verifierSignatures.map(s => `${s.verifier.slice(-4)}: ${s.status}`).join(', ');
      return `Session ID: ${session.sessionId}\nChain: ${session.chain}\nSignatures: ${signaturesSummary}\nTime: ${date}\n`;
    }).join('\n');

    ctx.reply(`✍️ Last 10 Signature Sessions for ${validator.description.moniker}'s Verifiers:\n\n${sessionsText}`, {
      parse_mode: "HTML"
    });
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
    this._amplifierPollsCMD();
    this._amplifierSignaturesCMD();
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
    const startBot = async () => {
      try {
        await this.bot.start({
          onStart: (botInfo) => {
            logger.info(`Bot ${botInfo.username} started`);
          },
        });
      } catch (error) {
        logger.error("Failed to start bot:", error);
        setTimeout(startBot, 5000);
      }
    };

    await startBot();

    setInterval(async () => {
      try {
        await this.bot.api.getMe();
      } catch (error) {
        logger.error("Bot connection lost, reconnecting...", error);
        await startBot();
      }
    }, 60000);
  }

  public async stop(): Promise<void> {
    await this.bot.stop();
    logger.info('Telegram bot stopped');
  }
}