import { AppDb } from "@/database/database";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import { Job } from "bull";
import { SignatureStatus, SignatureType } from "@/database/models/amplifier/signature.interface";
import { Logger } from "winston";
import { NotificationEvent, NotificationType } from "@/database/models/notification/notification.interface";
import appConfig from "@/config/index";

interface SignatureTrackingData {
  sessionId: string;
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

export class SignatureTrackingJob {
  private readonly logger: Logger;
  private readonly BATCH_SIZE = 100; // Process notifications in batches
  private readonly MAX_RETRIES = 3;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.logger = logger.child({
      name: SignatureTrackingJob.name
    });
  }

  private shouldNotify(verifier: string, status: SignatureType): boolean {
    if (!verifier || !status) {
      this.logger.warn('Invalid verifier or status provided', { verifier, status });
      return false;
    }

    if (!appConfig.monitoredVerifiers.includes(verifier)) {
      this.logger.debug(`Verifier ${verifier} not in monitored verifiers list`, { verifier });
      return false;
    }

    if (status !== SignatureType.INVALID && status !== SignatureType.UNSUBMITTED) {
      this.logger.debug(`Signature status ${status} does not require notification`, { status });
      return false;
    }

    return true;
  }

  private async createNotificationBatch(
    users: TelegramUser[],
    sessionId: string,
    verifier: string,
    status: SignatureType,
    timestamp: number,
    retryCount = 0
  ): Promise<NotificationResult[]> {
    const { notificationRepo } = this.db;
    const results: NotificationResult[] = [];
    const errors: Error[] = [];

    for (const user of users) {
      try {
        await notificationRepo.create({
          notification_id: `amplifier_signature_${sessionId}_${verifier}_${user.chat_id}_${timestamp}`,
          event: NotificationEvent.AMPLIFIER_SIGNATURE,
          data: {
            sessionId,
            verifier,
            moniker: verifier, // TODO: Implement moniker resolution
            status,
            timestamp
          },
          type: NotificationType.TELEGRAM,
          recipient: user.chat_id.toString(),
          sent: false,
          condition: "signature_status_change"
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
      const retryResults = await this.createNotificationBatch(users, sessionId, verifier, status, timestamp, retryCount + 1);
      results.push(...retryResults);
    }

    return results;
  }

  private async createNotifications(sessionId: string, verifier: string, status: SignatureType): Promise<BatchProcessingResult> {
    try {
      const { telegramUserRepo } = this.db;
      const now = Date.now();

      // Get all TG users
      const allTgUsers = await telegramUserRepo.findAll();
      if (!allTgUsers || allTgUsers.length === 0) {
        this.logger.warn('No Telegram users found for notifications');
        return { successCount: 0, failureCount: 0, failedUserIds: [] };
      }

      this.logger.info(`Creating notifications for ${allTgUsers.length} users about signature status change`);

      // Process in batches
      const results: NotificationResult[] = [];
      for (let i = 0; i < allTgUsers.length; i += this.BATCH_SIZE) {
        const userBatch = allTgUsers.slice(i, i + this.BATCH_SIZE);
        const batchResults = await this.createNotificationBatch(
          userBatch,
          sessionId,
          verifier,
          status,
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

  async process(job: Job<SignatureTrackingData>): Promise<void> {
    const { sessionId } = job.data;
    const { amplifierSignatureRepo } = this.db;
    const startTime = Date.now();

    try {
      const session = await amplifierSignatureRepo.findBySessionId(sessionId);
      if (!session) {
        this.logger.warn(`Signature session ${sessionId} not found`);
        return;
      }

      // Get current block height
      const currentHeight = await this.queryService.getCurrentBlockHeight();

      // Check if session has expired
      if (currentHeight >= session.expiresAt) {
        if (session.status === SignatureStatus.PENDING) {
          await amplifierSignatureRepo.updateStatus(sessionId, SignatureStatus.FAILED);
          this.logger.info(`Session ${sessionId} marked as Failed due to expiration`, {
            currentHeight,
            expiresAt: session.expiresAt,
            status: session.status
          });
        }
        return;
      }

      this.logger.debug(`Processing signature session ${sessionId}`, {
        currentHeight,
        expiresAt: session.expiresAt,
        status: session.status
      });

      let processedCount = 0;
      let errorCount = 0;
      let notificationStats = { totalSuccess: 0, totalFailure: 0 };

      // Update signature statuses
      for (const sig of session.signatures) {
        try {
          this.logger.info(`Checking signature status for verifier ${sig.verifier} in session ${sessionId}`);
          const currentStatus = await this.queryService.getSignatureStatus(sig.verifier, sessionId);
          const now = Date.now();
          
          this.logger.info(`Current status for verifier ${sig.verifier}: ${currentStatus}, previous status: ${sig.status}`);
          
          if (currentStatus !== sig.status) {
            this.logger.info(`Updating signature status for verifier ${sig.verifier} from ${sig.status} to ${currentStatus}`);
            await amplifierSignatureRepo.updateSignatureStatus(sessionId, sig.verifier, currentStatus);
            
            // Check if we should notify about this signature
            if (this.shouldNotify(sig.verifier, currentStatus)) {
              const result = await this.createNotifications(sessionId, sig.verifier, currentStatus);
              notificationStats.totalSuccess += result.successCount;
              notificationStats.totalFailure += result.failureCount;
              this.logger.info(
                `Created notifications for signature status change: ${sig.verifier} -> ${currentStatus}. ` +
                `Success: ${result.successCount}, Failed: ${result.failureCount}`
              );
            }
          } else {
            this.logger.debug(`No status change for verifier ${sig.verifier}, still ${currentStatus}`);
          }
          
          // Update lastChecked timestamp
          await amplifierSignatureRepo.updateSignatureLastChecked(sessionId, sig.verifier, now);
          processedCount++;
        } catch (error) {
          this.logger.error(`Error processing signature for ${sig.verifier} in session ${sessionId}:`, error);
          errorCount++;
          // Continue processing other signatures
          continue;
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      this.logger.info(
        `Completed signature tracking for session ${sessionId} in ${duration.toFixed(1)}s. ` +
        `Processed: ${processedCount}, Errors: ${errorCount}, ` +
        `Notifications - Success: ${notificationStats.totalSuccess}, Failed: ${notificationStats.totalFailure}`
      );
    } catch (error) {
      this.logger.error(`Error processing signature tracking job for session ${sessionId}:`, error);
      throw error;
    }
  }
}