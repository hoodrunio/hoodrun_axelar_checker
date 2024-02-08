import { NotificationRepository } from "@repositories/notification/NotificationRepository";
import { TelegramUserRepository } from "@repositories/telegram_user/TelegramUserRepository";
import { ValidatorRepository } from "@repositories/validator/ValidatorRepository";

export class AppDb {
  validatorRepository: ValidatorRepository;
  telegramUserRepo: TelegramUserRepository;
  notificationRepo: NotificationRepository;
  constructor() {
    this.validatorRepository = new ValidatorRepository();
    this.telegramUserRepo = new TelegramUserRepository();
    this.notificationRepo = new NotificationRepository();
  }
}
