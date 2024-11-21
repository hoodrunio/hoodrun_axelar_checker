import { AmplifierEventHandler } from '@/ws/handlers/AmplifierEventHandler';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { AmplifierQueueManager } from '@/queue/queue/AmplifierQueueManager';
import { PollStatus, VoteType } from '@/database/models/amplifier/poll.interface';
import { SignatureStatus, SignatureType } from '@/database/models/amplifier/signature.interface';
import { mock, MockProxy } from 'jest-mock-extended';

// Mock Bull
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    process: jest.fn(),
    on: jest.fn()
  }));
});

describe('AmplifierEventHandler', () => {
  let handler: AmplifierEventHandler;
  let mockDb: MockProxy<AppDb>;
  let mockQueryService: MockProxy<AmplifierQueryService>;
  let mockQueueManager: MockProxy<AmplifierQueueManager>;
  let mockAmplifierPollRepo: MockProxy<any>;
  let mockAmplifierSignatureRepo: MockProxy<any>;

  beforeEach(() => {
    // Mock repositories
    mockAmplifierPollRepo = mock<any>({
      findByPollId: jest.fn(),
      create: jest.fn(),
      updatePollStatus: jest.fn()
    });

    mockAmplifierSignatureRepo = mock<any>({
      findBySessionId: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn()
    });

    // Mock DB
    mockDb = mock<AppDb>({
      amplifierPollRepo: mockAmplifierPollRepo,
      amplifierSignatureRepo: mockAmplifierSignatureRepo
    });

    // Mock services
    mockQueryService = mock<AmplifierQueryService>();
    mockQueueManager = mock<AmplifierQueueManager>({
      addPollTrackingJob: jest.fn().mockResolvedValue(undefined),
      addSignatureTrackingJob: jest.fn().mockResolvedValue(undefined)
    });

    // Create handler with mocked dependencies
    handler = new AmplifierEventHandler(mockDb, mockQueryService);
    // @ts-ignore - private property access for testing
    handler['queueManager'] = mockQueueManager;
  });

  describe('handlePollStarted', () => {
    const validPollEvent = {
      source_chain: 'ethereum',
      poll_id: '123',
      participants: ['axelar1', 'axelar2'],
      expires_at: '1000',
      height: '500',
      hash: '0xabc'
    };

    it('should create new poll and add tracking job', async () => {
      mockAmplifierPollRepo.findByPollId.mockResolvedValue(null);
      mockAmplifierPollRepo.create.mockResolvedValue({
        pollId: '123',
        status: PollStatus.PENDING
      });

      await handler.handlePollStarted(validPollEvent);

      expect(mockAmplifierPollRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        pollId: '123',
        sourceChain: 'ethereum',
        status: PollStatus.PENDING,
        votes: [
          { voter: 'axelar1', vote: VoteType.UNSUBMITTED },
          { voter: 'axelar2', vote: VoteType.UNSUBMITTED }
        ]
      }));
      expect(mockQueueManager.addPollTrackingJob).toHaveBeenCalledWith('123', 500);
    });

    it('should skip poll creation if poll exists', async () => {
      const existingPoll = {
        pollId: '123',
        status: PollStatus.PENDING
      };
      mockAmplifierPollRepo.findByPollId.mockResolvedValue(existingPoll);

      await handler.handlePollStarted(validPollEvent);

      expect(mockAmplifierPollRepo.create).not.toHaveBeenCalled();
      expect(mockQueueManager.addPollTrackingJob).toHaveBeenCalledWith('123', 500);
    });

    it('should throw error for invalid event format', async () => {
      const invalidEvent = {
        source_chain: 'ethereum'
        // missing required fields
      };

      await expect(handler.handlePollStarted(invalidEvent))
        .rejects
        .toThrow('Invalid event format');
    });
  });

  describe('handleSigningStarted', () => {
    const validSigningEvent = {
      chain: 'ethereum',
      session_id: '456',
      _contract_address: '0xdef',
      pub_keys: {
        'axelar1': { ecdsa: 'key1' },
        'axelar2': { ecdsa: 'key2' }
      },
      verifier_set_id: '789',
      expires_at: '2000',
      height: '600',
      hash: '0xghi'
    };

    it('should create new signature session and add tracking job', async () => {
      mockAmplifierSignatureRepo.findBySessionId.mockResolvedValue(null);
      mockAmplifierSignatureRepo.create.mockResolvedValue({
        sessionId: '456',
        status: SignatureStatus.PENDING
      });

      await handler.handleSigningStarted(validSigningEvent);

      expect(mockAmplifierSignatureRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: '456',
        chain: 'ethereum',
        status: SignatureStatus.PENDING,
        signatures: [
          { verifier: 'axelar1', status: SignatureType.UNSUBMITTED },
          { verifier: 'axelar2', status: SignatureType.UNSUBMITTED }
        ]
      }));
      expect(mockQueueManager.addSignatureTrackingJob).toHaveBeenCalledWith('456', 600);
    });

    it('should skip signature session creation if session exists', async () => {
      const existingSession = {
        sessionId: '456',
        status: SignatureStatus.PENDING
      };
      mockAmplifierSignatureRepo.findBySessionId.mockResolvedValue(existingSession);

      await handler.handleSigningStarted(validSigningEvent);

      expect(mockAmplifierSignatureRepo.create).not.toHaveBeenCalled();
      expect(mockQueueManager.addSignatureTrackingJob).toHaveBeenCalledWith('456', 600);
    });
  });

  describe('handlePollCompleted', () => {
    it('should update poll status to COMPLETED when succeeded', async () => {
      const event = {
        poll_id: '123',
        status: 'succeeded_on_source_chain'
      };

      await handler.handlePollCompleted(event);

      expect(mockAmplifierPollRepo.updatePollStatus)
        .toHaveBeenCalledWith('123', PollStatus.COMPLETED);
    });

    it('should update poll status to FAILED when not found', async () => {
      const event = {
        poll_id: '123',
        status: 'not_found_on_source_chain'
      };

      await handler.handlePollCompleted(event);

      expect(mockAmplifierPollRepo.updatePollStatus)
        .toHaveBeenCalledWith('123', PollStatus.FAILED);
    });
  });

  describe('handleSigningCompleted', () => {
    it('should update signature session status to COMPLETED', async () => {
      const event = {
        session_id: '456'
      };

      await handler.handleSigningCompleted(event);

      expect(mockAmplifierSignatureRepo.updateStatus)
        .toHaveBeenCalledWith('456', SignatureStatus.COMPLETED);
    });
  });
}); 