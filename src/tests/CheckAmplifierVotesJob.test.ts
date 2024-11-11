import { CheckAmplifierVotesJob } from '@/queue/jobs/amplifier/CheckAmplifierVotesJob';
import { AmplifierVoteChecker } from '@/services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '@/services/amplifier/AmplifierVerifierService';
import { AmplifierVoteType } from '@/types/amplifier';
import { AmplifierPollState } from '@/database/models/amplifier/interfaces';
import { AppDb } from '@/database/database';

jest.mock('@/services/amplifier/AmplifierVoteChecker');
jest.mock('@/services/amplifier/AmplifierVerifierService');
jest.mock('@/database/database');

describe('CheckAmplifierVotesJob', () => {
  let job: CheckAmplifierVotesJob;
  let mockDb: jest.Mocked<AppDb>;
  let mockVoteChecker: jest.Mocked<AmplifierVoteChecker>;
  let mockVerifierService: jest.Mocked<AmplifierVerifierService>;

  beforeEach(() => {
    // Mock VoteChecker
    mockVoteChecker = {
      findOne: jest.fn(),
      checkVoteStatus: jest.fn(),
      getVoteTxInfo: jest.fn()
    } as unknown as jest.Mocked<AmplifierVoteChecker>;

    // Mock VerifierService
    const MockVerifierService = jest.fn(() => ({
      isConfigured: jest.fn().mockReturnValue(true),
      getVerifierAddress: jest.fn().mockReturnValue('verifier_address')
    }));

    mockVerifierService = new MockVerifierService() as unknown as jest.Mocked<AmplifierVerifierService>;
    (AmplifierVerifierService.getInstance as jest.Mock).mockReturnValue(mockVerifierService);

    // Mock AppDb
    mockDb = {
      amplifierVoteRepo: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
        find: jest.fn(),
        updateVoteStatus: jest.fn()
      },
      amplifierPollRepo: {
        findOne: jest.fn(),
        updateOne: jest.fn()
      }
    } as unknown as jest.Mocked<AppDb>;
    (AppDb as jest.Mock).mockImplementation(() => mockDb);

    job = new CheckAmplifierVotesJob(mockVoteChecker);
  });

  it('should update vote status when changed', async () => {
    const mockJob = {
      data: { pollId: 'test_poll_id' }
    };

    mockDb.amplifierVoteRepo.findOne = jest.fn().mockResolvedValue({
      customId: 'test_poll_id_verifier_address',
      vote: AmplifierVoteType.UNSUBMITTED
    });
    
    mockVoteChecker.checkVoteStatus = jest.fn().mockResolvedValue(AmplifierVoteType.YES);
    mockVoteChecker.getVoteTxInfo = jest.fn().mockResolvedValue({
      txHash: 'test_hash',
      txHeight: 123
    });
    
    mockDb.amplifierPollRepo.findOne = jest.fn().mockResolvedValue({
      pollId: 'test_poll_id',
      expiresAt: Date.now() + 1000000
    });

    await job.process(mockJob as any);

    expect(mockDb.amplifierVoteRepo.updateVoteStatus).toHaveBeenCalledWith(
      'test_poll_id_verifier_address',
      AmplifierVoteType.YES,
      {
        txHash: 'test_hash',
        txHeight: 123
      }
    );
  });
});