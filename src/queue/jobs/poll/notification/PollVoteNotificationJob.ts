import appConfig from "@config/index";
import { AppDb } from "@database/database";
import {
  NotificationEvent,
  NotificationType,
  PollVoteNotificationDataType,
} from "@database/models/notification/notification.interface";
import { PollVoteType } from "@database/models/polls/poll_vote/poll_vote.interface";
import { logger } from "@utils/logger";
import { createPollVoteCondition } from "notification/condition/pollVote";
import { xSeconds } from "queue/jobHelper";
import appJobProducer from "queue/producer/AppJobProducer";
import AppQueueFactory from "queue/queue/AppQueueFactory";

const POLL_VOTE_NOTIFICATION_JOB = "pollVoteNotificationJob";

export const initPollVoteNotificationQueue = async () => {
  const pollVoteNotificationJobQueue = AppQueueFactory.createQueue(
    POLL_VOTE_NOTIFICATION_JOB
  );

  pollVoteNotificationJobQueue.process(async () => {
    try {
      const {
        pollVoteRepo,
        validatorRepository,
        telegramUserRepo,
        notificationRepo,
      } = new AppDb();

      const xHourAgoDate = new Date();
      xHourAgoDate.setHours(
        xHourAgoDate.getHours() - appConfig.maxLastXHourPollVoteNotification
      );

      const vote = PollVoteType.NO;
      const allNoPollVotes = await pollVoteRepo.findAll({
        vote,
        createdAt: { $gte: xHourAgoDate },
        checkedForNotification: false,
        sort: { createdAt: -1 },
      });

      const promisses = allNoPollVotes?.map(async (pollVote) => {
        const voterValidator = await validatorRepository.findOne({
          voter_address: pollVote.voter_address,
        });
        if (!voterValidator) return Promise.resolve();

        const tgUsers = await telegramUserRepo.findAll({});
        if (!tgUsers || tgUsers.length < 1) Promise.resolve();
        const pollVoteCondition = createPollVoteCondition(pollVote);
        for (const tgUser of tgUsers) {
          const chatId = tgUser.chat_id;
          const data: PollVoteNotificationDataType = {
            chain: pollVote.pollChain,
            pollId: pollVote.pollId,
            vote: pollVote.vote,
            operatorAddress: voterValidator.operator_address,
            moniker: voterValidator.description.moniker,
          };
          const notificationId = `poll_vote-${pollVote.pollId}-${pollVote.voter_address}-${chatId}`;

          await notificationRepo.upsertOne(
            { notification_id: notificationId },
            {
              data,
              type: NotificationType.TELEGRAM,
              notification_id: notificationId,
              event: NotificationEvent.POOL_VOTE,
              condition: pollVoteCondition,
              recipient: chatId.toString(),
              sent: false,
            }
          );
        }

        await pollVoteRepo.updateOne(pollVote._id!, {
          checkedForNotification: true,
        });
      });

      await Promise.allSettled(promisses);
    } catch (error) {
      logger.error("Error in Poll Vote Notification Job", error);
      return Promise.resolve(error);
    }
    return Promise.resolve();
  });
};

export const addPollVoteNotificationJob = () => {
  appJobProducer.addJob(
    POLL_VOTE_NOTIFICATION_JOB,
    {},
    {
      repeat: { every: xSeconds(20) },
    }
  );
};
