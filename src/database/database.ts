import { NotificationRepository } from "@repositories/notification/NotificationRepository";
import { PollRepository } from "@repositories/poll/PollRepository";
import { TelegramUserRepository } from "@repositories/telegram_user/TelegramUserRepository";
import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";

export class AppDb {
  validatorRepository: ValidatorRepository;
  telegramUserRepo: TelegramUserRepository;
  notificationRepo: NotificationRepository;
  pollRepo: PollRepository;
  constructor() {
    this.validatorRepository = new ValidatorRepository();
    this.telegramUserRepo = new TelegramUserRepository();
    this.notificationRepo = new NotificationRepository();
    this.pollRepo = new PollRepository();
  }
}
