import {
  ITelegramUser,
  ITelegramUserDocument,
} from "@database/models/telegram_user/telegram_user.interface";
import TelegramUserDbModel from "@database/models/telegram_user/telegram_user.model";
import BaseRepository from "@repositories/base.repository";

export class TelegramUserRepository extends BaseRepository<
  ITelegramUser,
  ITelegramUserDocument
> {
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

  async removeOperatorAddressFromChat(params: {
    chat_id: number;
    operator_address: string;
  }): Promise<void> {
    const { chat_id, operator_address } = params;

    await TelegramUserDbModel.updateOne(
      { chat_id },
      {
        $pull: {
          operator_addresses: operator_address,
        },
      }
    );
  }
}
