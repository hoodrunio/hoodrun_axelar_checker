import { Bot } from "grammy";
import { Commands } from "./Commands";
import { TgReply } from "./TGReply";
import appConfig from "src/config";

export class TGBot {
  private static _instance: TGBot;
  bot: Bot;
  tgReply: TgReply;

  private constructor({ token }: { token: string }) {
    this.bot = new Bot(token);
    this.tgReply = new TgReply();
  }

  public static async getInstance() {
    if (!TGBot._instance) {
      const _instance = new TGBot({ token: appConfig.tgToken });
      TGBot._instance = _instance;

      _instance.appendBaseSubscribers();
      _instance.initCommands();
      _instance.initBot();
    }

    return TGBot._instance;
  }

  private appendBaseSubscribers() {
    this._initNewChatCMD();
    this._onMessage();
    this._addOperatorAddressCMD();
  }

  private _initNewChatCMD() {
    this.bot.command("start", (ctx) => {
      ctx.reply(this.tgReply.startReply(), { parse_mode: "HTML" });
    });
  }
  private _onMessage() {
    this.bot.on("message", (ctx) => {
      const {
        message: { text },
      } = ctx;

      ctx.reply(`You Sent ${text}}`);
    });
  }

  private _addOperatorAddressCMD() {
    this.bot.command(Commands.AddOperatorAddress.command, (ctx) => {});
  }

  private async initCommands() {
    const commands = Object.values(Commands);

    await this.bot.api.setMyCommands(commands);
  }
  private async initBot() {
    await this.bot.start();
  }
}
