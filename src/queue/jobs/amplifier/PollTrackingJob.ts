import { AppDb } from "@/database/database";
import { PollStatus, VoteType } from "@/database/models/amplifier/poll.interface";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import { Job } from "bull";
import { Logger } from "winston";

interface PollTrackingData {
  pollId: string;
  currentHeight: number;
}

export class PollTrackingJob {
  private readonly logger: Logger;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.logger = logger.child({
      name: PollTrackingJob.name
    });
  }

  async process(job: Job<PollTrackingData>): Promise<void> {
    const { pollId, currentHeight } = job.data;
    const { amplifierPollRepo } = this.db;

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

      // Update vote statuses
      for (const vote of poll.votes) {
        const currentStatus = await this.queryService.getVoteStatus(vote.voter, pollId);
        if (currentStatus !== vote.vote) {
          await amplifierPollRepo.updateVoteStatus(pollId, vote.voter, currentStatus);
          this.logger.info(`Updated vote status for ${vote.voter} in poll ${pollId} to ${currentStatus}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing poll tracking for ${pollId}:`, error);
      throw error;
    }
  }
}