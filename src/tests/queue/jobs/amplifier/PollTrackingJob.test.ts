import { PollTrackingJob } from '@/queue/jobs/amplifier/PollTrackingJob';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { Job } from 'bull';
import { PollStatus, VoteType } from '@/database/models/amplifier/poll.interface';
import { mock, MockProxy } from 'jest-mock-extended';
import { AmplifierPollRepository } from '@/repositories/amplifier/AmplifierPollRepository';

describe('PollTrackingJob', () => {
  let job: PollTrackingJob;
  let mockDb: MockProxy<AppDb>;
  let mockQueryService: MockProxy<AmplifierQueryService>;
  let mockPollRepo: MockProxy<AmplifierPollRepository>;

  beforeEach(() => {
    mockPollRepo = mock<AmplifierPollRepository>();
    mockDb = mock<AppDb>({
      amplifierPollRepo: mockPollRepo
    });
    mockQueryService = mock<AmplifierQueryService>();
    job = new PollTrackingJob(mockDb, mockQueryService);
  });

  it('should update vote statuses for active poll', async () => {
    const mockPoll = {
      pollId: '123',
      expiresAt: 1000,
      status: PollStatus.PENDING,
      votes: [
        { voter: 'validator1', vote: VoteType.UNSUBMITTED },
        { voter: 'validator2', vote: VoteType.NO }
      ]
    };

    const mockJobData = {
      pollId: '123',
      currentHeight: 500
    };

    mockPollRepo.findByPollId.mockResolvedValue(mockPoll as any);
    mockQueryService.getVoteStatus.mockResolvedValueOnce(VoteType.YES);
    mockQueryService.getVoteStatus.mockResolvedValueOnce(VoteType.NO);

    await job.process({ data: mockJobData } as Job);

    expect(mockPollRepo.updateVoteStatus).toHaveBeenCalledWith('123', 'validator1', VoteType.YES);
    expect(mockPollRepo.updateVoteStatus).not.toHaveBeenCalledWith('123', 'validator2', VoteType.NO);
  });

  it('should mark poll as Failed when expired', async () => {
    const mockPoll = {
      pollId: '123',
      expiresAt: 1000,
      status: PollStatus.PENDING,
      votes: []
    };

    const mockJobData = {
      pollId: '123',
      currentHeight: 1001
    };

    mockPollRepo.findByPollId.mockResolvedValue(mockPoll as any);

    await job.process({ data: mockJobData } as Job);

    expect(mockPollRepo.updatePollStatus).toHaveBeenCalledWith('123', PollStatus.FAILED);
  });

  it('should handle non-existent poll', async () => {
    const mockJobData = {
      pollId: '123',
      currentHeight: 500
    };

    mockPollRepo.findByPollId.mockResolvedValue(null);

    await job.process({ data: mockJobData } as Job);

    expect(mockPollRepo.updateVoteStatus).not.toHaveBeenCalled();
    expect(mockPollRepo.updatePollStatus).not.toHaveBeenCalled();
  });
}); 