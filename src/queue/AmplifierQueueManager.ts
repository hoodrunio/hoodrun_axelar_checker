import Queue from 'bull';
import { AMPLIFIER_CONFIG, AMPLIFIER_QUEUE_NAMES } from '@/config/amplifier.config';
import { AmplifierVoteChecker } from '@/services/amplifier/AmplifierVoteChecker';
import { logger } from '@/utils/logger';

export class AmplifierQueueManager {
  private voteCheckQueue: Queue.Queue;
  private voteChecker: AmplifierVoteChecker;

  constructor(voteChecker: AmplifierVoteChecker) {
    this.voteChecker = voteChecker;
    this.voteCheckQueue = this.initializeVoteCheckQueue();
  }

  private initializeVoteCheckQueue(): Queue.Queue {
    const queue = new Queue(AMPLIFIER_QUEUE_NAMES.VOTE_CHECK, {
      defaultJobOptions: {
        attempts: AMPLIFIER_CONFIG.VOTE_CHECK_MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    queue.process(async (job) => {
      const { pollId } = job.data;
      await this.voteChecker.checkVotes(pollId);
    });

    queue.on('failed', (job, err) => {
      logger.error(`Vote check job failed for poll ${job.data.pollId}:`, err);
    });

    return queue;
  }

  public async scheduleVoteCheck(pollId: string) {
    await this.voteCheckQueue.add(
      { pollId },
      { 
        delay: AMPLIFIER_CONFIG.VOTE_CHECK_INTERVAL,
        jobId: `vote-check-${pollId}`
      }
    );
  }

  public close() {
    return Promise.all([
      this.voteCheckQueue.close()
    ]);
  }
} 