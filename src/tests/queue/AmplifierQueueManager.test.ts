import { AmplifierQueueManager } from '@/queue/queue/AmplifierQueueManager';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import Bull from 'bull';
import { mock, MockProxy } from 'jest-mock-extended';
import AppQueueFactory from '@/queue/queue/AppQueueFactory';

jest.mock('bull');
jest.mock('@/queue/queue/AppQueueFactory');

describe('AmplifierQueueManager', () => {
  let queueManager: AmplifierQueueManager;
  let mockDb: MockProxy<AppDb>;
  let mockQueryService: MockProxy<AmplifierQueryService>;
  let mockPollQueue: MockProxy<Bull.Queue>;
  let mockSignatureQueue: MockProxy<Bull.Queue>;

  beforeEach(() => {
    mockDb = mock<AppDb>();
    mockQueryService = mock<AmplifierQueryService>();
    mockPollQueue = mock<Bull.Queue>();
    mockSignatureQueue = mock<Bull.Queue>();

    // Mock AppQueueFactory
    (AppQueueFactory.createQueue as jest.Mock).mockImplementation((queueName: string) => {
      if (queueName === 'amplifier-poll-tracking') return mockPollQueue;
      if (queueName === 'amplifier-signature-tracking') return mockSignatureQueue;
      return mockPollQueue; // default fallback
    });

    queueManager = new AmplifierQueueManager(mockDb, mockQueryService);
  });

  afterEach(async () => {
    await queueManager.close();
    jest.clearAllMocks();
  });

  describe('addPollTrackingJob', () => {
    it('should add a poll tracking job to the queue with correct parameters', async () => {
      const pollId = 'test-poll-id';
      const currentHeight = 1000;

      await queueManager.addPollTrackingJob(pollId, currentHeight);

      expect(mockPollQueue.add).toHaveBeenCalledWith(
        { pollId, currentHeight },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      );
    });

    it('should handle queue errors gracefully', async () => {
      const pollId = 'test-poll-id';
      const currentHeight = 1000;

      mockPollQueue.add.mockRejectedValueOnce(new Error('Queue error'));

      await expect(queueManager.addPollTrackingJob(pollId, currentHeight))
        .rejects
        .toThrow('Queue error');
    });
  });

  describe('addSignatureTrackingJob', () => {
    it('should add a signature tracking job to the queue with correct parameters', async () => {
      const sessionId = 'test-session-id';
      const currentHeight = 1000;

      await queueManager.addSignatureTrackingJob(sessionId, currentHeight);

      expect(mockSignatureQueue.add).toHaveBeenCalledWith(
        { sessionId, currentHeight },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      );
    });

    it('should handle queue errors gracefully', async () => {
      const sessionId = 'test-session-id';
      const currentHeight = 1000;

      mockSignatureQueue.add.mockRejectedValueOnce(new Error('Queue error'));

      await expect(queueManager.addSignatureTrackingJob(sessionId, currentHeight))
        .rejects
        .toThrow('Queue error');
    });
  });

  describe('close', () => {
    it('should close both queues properly', async () => {
      await queueManager.close();

      expect(mockPollQueue.close).toHaveBeenCalled();
      expect(mockSignatureQueue.close).toHaveBeenCalled();
    });

    it('should handle queue closing errors', async () => {
      mockPollQueue.close.mockRejectedValueOnce(new Error('Close error'));

      await expect(queueManager.close())
        .rejects
        .toThrow('Close error');
    });
  });
}); 