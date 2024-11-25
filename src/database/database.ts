import { AxlStateRepository } from "@repositories/axlstate/AxlStateRepository";
import { NotificationRepository } from "@repositories/notification/NotificationRepository";
import { PollRepository } from "@repositories/poll/PollRepository";
import { PollVoteRepository } from "@repositories/poll/PollVoteRepository";
import { TelegramUserRepository } from "@repositories/telegram_user/TelegramUserRepository";
import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";
import { AmplifierPollRepository } from "@repositories/amplifier/AmplifierPollRepository";
import { AmplifierSignatureRepository } from "@repositories/amplifier/AmplifierSignatureRepository";
import mongoose from 'mongoose';

export class AppDb {
  validatorRepository: ValidatorRepository;
  telegramUserRepo: TelegramUserRepository;
  notificationRepo: NotificationRepository;
  pollRepo: PollRepository;
  axlStateRepo: AxlStateRepository;
  pollVoteRepo: PollVoteRepository;
  public readonly amplifierPollRepo: AmplifierPollRepository;
  public readonly amplifierSignatureRepo: AmplifierSignatureRepository;
  constructor() {
    this.validatorRepository = new ValidatorRepository();
    this.telegramUserRepo = new TelegramUserRepository();
    this.notificationRepo = new NotificationRepository();
    this.pollRepo = new PollRepository();
    this.pollVoteRepo = new PollVoteRepository();
    this.axlStateRepo = new AxlStateRepository();
    this.amplifierPollRepo = new AmplifierPollRepository();
    this.amplifierSignatureRepo = new AmplifierSignatureRepository();
  }

  async close() {
    await mongoose.connection.close();
  }
}