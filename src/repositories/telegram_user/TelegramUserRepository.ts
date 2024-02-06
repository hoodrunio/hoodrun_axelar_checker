import { ITelegramUser } from "@database/models/telegram_user/telegram_user.interface";
import TelegramUserDbModel from "@database/models/telegram_user/telegram_user.model";
import { IValidator } from "@database/models/validator/validator.interface";
import ValidatorDbModel from "@database/models/validator/validator.model";
import BaseRepository from "@repositories/base.repository";

export class TelegramUserRepository extends BaseRepository<ITelegramUser> {
  constructor() {
    super(TelegramUserDbModel);
  }

  async isChatAlreadyExist(chat_id: number): Promise<boolean> {
    const telegram_user = await this.findOne({
      chat_id,
    });

    return !!telegram_user;
  }

  async addOperatorAddressToChat(params: {
    chat_id: number;
    operator_address: string;
  }): Promise<void> {
    const { chat_id, operator_address } = params;

    await TelegramUserDbModel.updateOne(
      { chat_id },
      {
        $addToSet: {
          operator_addresses: operator_address,
        },
      }
    );
  }
}
