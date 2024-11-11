import { AppDb } from '@/database/database';
import { AmplifierVoteType } from '@/types/amplifier';
import { logger } from '@/utils/logger';
import { IAmplifierPoll } from '@/database/models/amplifier/interfaces';
import {
  NotificationEvent,
  NotificationType,
} from '@/database/models/notification/notification.interface';
import { AMPLIFIER_CONFIG } from '@/config/amplifier.config';
import { PollVoteType } from '@/database/models/polls/poll_vote/poll_vote.interface';

export class AmplifierNotificationService {
  private db: AppDb;

  constructor() {
    this.db = new AppDb();
  }

  async processNewVotes() {
    try {
      const {
        amplifierVoteRepo,
        validatorRepository,
        telegramUserRepo,
        notificationRepo,
      } = this.db;

      const xHourAgoDate = new Date();
      xHourAgoDate.setHours(
        xHourAgoDate.getHours() - AMPLIFIER_CONFIG.MAX_LAST_X_HOUR_POLL_VOTE_NOTIFICATION
      );

      const uncheckedVotes = await amplifierVoteRepo.find({
        checkedForNotification: false,
        vote: { $ne: AmplifierVoteType.UNSUBMITTED },
        createdAt: { $gte: xHourAgoDate }
      });

      const promises = uncheckedVotes.map(async (vote) => {
        if (vote.vote === AmplifierVoteType.NO) {
          const voterValidator = await validatorRepository.findOne({
            voter_address: vote.voterAddress,
          });
          
          if (!voterValidator) return;

          const tgUsers = await telegramUserRepo.findAll({});
          if (!tgUsers?.length) return;

          const poll = await this.db.amplifierPollRepo.findOne({ pollId: vote.pollId });
          
          for (const tgUser of tgUsers) {
            const chatId = tgUser.chat_id;
            const notificationId = `amplifier_vote-${vote.pollId}-${vote.voterAddress}-${chatId}`;

            await notificationRepo.upsertOne(
              { notification_id: notificationId },
              {
                data: {
                  chain: (poll as IAmplifierPoll)?.sourceChain || 'unknown',
                  pollId: vote.pollId,
                  vote: vote.vote as unknown as PollVoteType,
                  operatorAddress: voterValidator.operator_address,
                  moniker: voterValidator.description.moniker,
                },
                type: NotificationType.TELEGRAM,
                notification_id: notificationId,
                event: NotificationEvent.POOL_VOTE,
                recipient: chatId.toString(),
                sent: false,
              }
            );
          }
        }

        await amplifierVoteRepo.updateOne(
          { customId: vote.customId },
          { checkedForNotification: true }
        );
      });

      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Error processing amplifier notifications:', error);
      throw error;
    }
  }
}