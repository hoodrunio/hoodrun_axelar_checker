import { SignatureTrackingJob } from '@/queue/jobs/amplifier/SignatureTrackingJob';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { Job } from 'bull';
import { SignatureStatus, SignatureType } from '@/database/models/amplifier/signature.interface';
import { mock, MockProxy } from 'jest-mock-extended';
import { AmplifierSignatureRepository } from '@/repositories/amplifier/AmplifierSignatureRepository';

describe('SignatureTrackingJob', () => {
  let job: SignatureTrackingJob;
  let mockDb: MockProxy<AppDb>;
  let mockQueryService: MockProxy<AmplifierQueryService>;
  let mockSignatureRepo: MockProxy<AmplifierSignatureRepository>;

  beforeEach(() => {
    mockSignatureRepo = mock<AmplifierSignatureRepository>();
    mockDb = mock<AppDb>({
      amplifierSignatureRepo: mockSignatureRepo
    });
    mockQueryService = mock<AmplifierQueryService>();
    job = new SignatureTrackingJob(mockDb, mockQueryService);
  });

  it('should update signature statuses for active session', async () => {
    const mockSession = {
      sessionId: '123',
      expiresAt: 1000,
      status: SignatureStatus.PENDING,
      signatures: [
        { verifier: 'validator1', status: SignatureType.UNSUBMITTED },
        { verifier: 'validator2', status: SignatureType.INVALID }
      ]
    };

    const mockJobData = {
      sessionId: '123',
      currentHeight: 500
    };

    mockSignatureRepo.findBySessionId.mockResolvedValue(mockSession as any);
    mockQueryService.getSignatureStatus.mockResolvedValueOnce(SignatureType.YES);
    mockQueryService.getSignatureStatus.mockResolvedValueOnce(SignatureType.INVALID);

    await job.process({ data: mockJobData } as Job);

    expect(mockSignatureRepo.updateSignatureStatus)
      .toHaveBeenCalledWith('123', 'validator1', SignatureType.YES);
    expect(mockSignatureRepo.updateSignatureStatus)
      .not.toHaveBeenCalledWith('123', 'validator2', SignatureType.INVALID);
  });

  it('should mark session as Failed when expired', async () => {
    const mockSession = {
      sessionId: '123',
      expiresAt: 1000,
      status: SignatureStatus.PENDING,
      signatures: []
    };

    const mockJobData = {
      sessionId: '123',
      currentHeight: 1001
    };

    mockSignatureRepo.findBySessionId.mockResolvedValue(mockSession as any);

    await job.process({ data: mockJobData } as Job);

    expect(mockSignatureRepo.updateStatus)
      .toHaveBeenCalledWith('123', SignatureStatus.FAILED);
  });

  it('should handle non-existent session', async () => {
    const mockJobData = {
      sessionId: '123',
      currentHeight: 500
    };

    mockSignatureRepo.findBySessionId.mockResolvedValue(null);

    await job.process({ data: mockJobData } as Job);

    expect(mockSignatureRepo.updateSignatureStatus).not.toHaveBeenCalled();
    expect(mockSignatureRepo.updateStatus).not.toHaveBeenCalled();
  });
}); 