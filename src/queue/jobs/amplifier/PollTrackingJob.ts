import { AppDb } from "@/database/database";
import { PollStatus, VoteType } from "@/database/models/amplifier/poll.interface";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import { Job } from "bull";
import { Logger } from "winston";
import { NotificationEvent, NotificationType } from "@/database/models/notification/notification.interface";
import appConfig from "@/config/index";

interface PollTrackingData {
  pollId: string;
  currentHeight: number;
}

interface NotificationResult {
  success: boolean;
  userId: string;
  error?: Error;
}

interface TelegramUser {
  chat_id: number;
  [key: string]: any;
}

interface BatchProcessingResult {
  successCount: number;
  failureCount: number;
  failedUserIds: string[];
}

export class PollTrackingJob {
  private readonly logger: Logger;
  private readonly BATCH_SIZE = 100; // Process notifications in batches
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.logger = logger.child({
      name: PollTrackingJob.name
    });
  }

  private shouldNotify(voter: string, status: VoteType): boolean {
    if (!voter || !status) {
      this.logger.warn('Invalid voter or status provided', { voter, status });
      return false;
    }

    if (!appConfig.monitoredVerifiers.includes(voter)) {
      this.logger.debug(`Voter ${voter} not in monitored verifiers list`, { voter });
      return false;
    }

    if (status !== VoteType.NO && status !== VoteType.UNSUBMITTED) {
      this.logger.debug(`Vote status ${status} does not require notification`, { status });
      return false;
    }

    return true;
  }

  private async createNotificationBatch(
    users: TelegramUser[],
    pollId: string,
    voter: string,
    vote: VoteType,
    timestamp: number,
    retryCount = 0
  ): Promise<NotificationResult[]> {
    const { notificationRepo } = this.db;
    const results: NotificationResult[] = [];
    const errors: Error[] = [];

    for (const user of users) {
      try {
        await notificationRepo.create({
          notification_id: `amplifier_vote_${pollId}_${voter}_${user.chat_id}_${timestamp}`,
          event: NotificationEvent.AMPLIFIER_VOTE,
          data: {
            pollId,
            voter,
            moniker: voter, // TODO: Implement moniker resolution
            vote,
            timestamp
          },
          type: NotificationType.TELEGRAM,
          recipient: user.chat_id.toString(),
          sent: false,
          condition: "vote_status_change"
        });

        results.push({ success: true, userId: user.chat_id.toString() });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to create notification for user ${user.chat_id}:`, { error: errorMessage, retryCount });
        
        if (retryCount < this.MAX_RETRIES) {
          errors.push(error instanceof Error ? error : new Error(errorMessage));
        } else {
          results.push({ 
            success: false, 
            userId: user.chat_id.toString(),
            error: error instanceof Error ? error : new Error(errorMessage)
          });
        }
      }
    }

    // Retry failed notifications
    if (errors.length > 0 && retryCount < this.MAX_RETRIES) {
      this.logger.info(`Retrying ${errors.length} failed notifications. Attempt ${retryCount + 1}/${this.MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      const retryResults = await this.createNotificationBatch(users, pollId, voter, vote, timestamp, retryCount + 1);
      results.push(...retryResults);
    }

    return results;
  }

  private async createNotifications(pollId: string, voter: string, vote: VoteType): Promise<BatchProcessingResult> {
    try {
      const { telegramUserRepo } = this.db;
      const now = Date.now();

      // Get all TG users
      const allTgUsers = await telegramUserRepo.findAll();
      if (!allTgUsers || allTgUsers.length === 0) {
        this.logger.warn('No Telegram users found for notifications');
        return { successCount: 0, failureCount: 0, failedUserIds: [] };
      }

      this.logger.info(`Creating notifications for ${allTgUsers.length} users about vote status change`);

      // Process in batches
      const results: NotificationResult[] = [];
      for (let i = 0; i < allTgUsers.length; i += this.BATCH_SIZE) {
        const userBatch = allTgUsers.slice(i, i + this.BATCH_SIZE);
        const batchResults = await this.createNotificationBatch(
          userBatch,
          pollId,
          voter,
          vote,
          now
        );
        results.push(...batchResults);

        // Log progress for large batches
        if (allTgUsers.length > this.BATCH_SIZE) {
          const processed = Math.min(i + this.BATCH_SIZE, allTgUsers.length);
          const successCount = results.filter(r => r.success).length;
          this.logger.info(
            `Processed ${processed}/${allTgUsers.length} notifications. ` +
            `Current success rate: ${((successCount / processed) * 100).toFixed(1)}%`
          );
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const failedUserIds = results.filter(r => !r.success).map(r => r.userId);

      this.logger.info(
        `Notification creation complete. ` +
        `Success: ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%), ` +
        `Failed: ${failureCount}`
      );

      if (failureCount > 0) {
        this.logger.warn('Failed notifications:', failedUserIds.join(', '));
      }

      return { successCount, failureCount, failedUserIds };
    } catch (error) {
      this.logger.error('Error in createNotifications:', error);
      throw error;
    }
  }

  async process(job: Job<PollTrackingData>): Promise<void> {
    const { pollId, currentHeight } = job.data;
    const { amplifierPollRepo } = this.db;
    const startTime = Date.now();

    try {
      const poll = await amplifierPollRepo.findByPollId(pollId);
      if (!poll) {
        this.logger.warn(`Poll ${pollId} not found`);
        return;
      }

      // Check if poll has expired
      if (currentHeight >= poll.expiresAt) {
        if (poll.status === PollStatus.PENDING) {
          await amplifierPollRepo.updatePollStatus(pollId, PollStatus.FAILED);
          this.logger.info(`Poll ${pollId} marked as Failed due to expiration`);
        }
        return;
      }

      let processedCount = 0;
      let errorCount = 0;
      let notificationStats = { totalSuccess: 0, totalFailure: 0 };

      // Update vote statuses
      for (const vote of poll.votes) {
        try {
          const currentStatus = await this.queryService.getVoteStatus(vote.voter, pollId);
          const now = Date.now();
          
          if (currentStatus !== vote.vote) {
            await amplifierPollRepo.updateVoteStatus(pollId, vote.voter, currentStatus);
            
            // Check if we should notify about this vote
            if (this.shouldNotify(vote.voter, currentStatus)) {
              const result = await this.createNotifications(pollId, vote.voter, currentStatus);
              notificationStats.totalSuccess += result.successCount;
              notificationStats.totalFailure += result.failureCount;
              this.logger.info(
                `Created notifications for vote status change: ${vote.voter} -> ${currentStatus}. ` +
                `Success: ${result.successCount}, Failed: ${result.failureCount}`
              );
            }
          }
          
          // Update lastChecked timestamp
          await amplifierPollRepo.updateVoteLastChecked(pollId, vote.voter, now);
          processedCount++;
        } catch (error) {
          this.logger.error(`Error processing vote for ${vote.voter} in poll ${pollId}:`, error);
          errorCount++;
          // Continue processing other votes
          continue;
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.info(
        `Completed vote tracking for poll ${pollId} in ${duration.toFixed(1)}s. ` +
        `Processed: ${processedCount}, Errors: ${errorCount}, ` +
        `Notifications - Success: ${notificationStats.totalSuccess}, Failed: ${notificationStats.totalFailure}`
      );
    } catch (error) {
      this.logger.error(`Error processing poll tracking job for ${pollId}:`, error);
      throw error;
    }
  }
}