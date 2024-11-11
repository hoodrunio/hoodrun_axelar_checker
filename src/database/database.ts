import { AxlStateRepository } from "@repositories/axlstate/AxlStateRepository";
import { NotificationRepository } from "@repositories/notification/NotificationRepository";
import { PollRepository } from "@repositories/poll/PollRepository";
import { PollVoteRepository } from "@repositories/poll/PollVoteRepository";
import { TelegramUserRepository } from "@repositories/telegram_user/TelegramUserRepository";
import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";
import { AmplifierVoteRepository } from "@repositories/amplifier/AmplifierVoteRepository";
import { AmplifierPollRepository } from "@repositories/amplifier/AmplifierPollRepository";
import mongoose from 'mongoose';

export class AppDb {
  validatorRepository: ValidatorRepository;
  telegramUserRepo: TelegramUserRepository;
  notificationRepo: NotificationRepository;
  pollRepo: PollRepository;
  axlStateRepo: AxlStateRepository;
  pollVoteRepo: PollVoteRepository;
  amplifierVoteRepo: AmplifierVoteRepository;
  amplifierPollRepo: AmplifierPollRepository;

  constructor() {
    this.validatorRepository = new ValidatorRepository();
    this.telegramUserRepo = new TelegramUserRepository();
    this.notificationRepo = new NotificationRepository();
    this.pollRepo = new PollRepository();
    this.pollVoteRepo = new PollVoteRepository();
    this.axlStateRepo = new AxlStateRepository();
    this.amplifierVoteRepo = new AmplifierVoteRepository();
    this.amplifierPollRepo = new AmplifierPollRepository();
  }

  async close() {
    await mongoose.connection.close();
  }

}