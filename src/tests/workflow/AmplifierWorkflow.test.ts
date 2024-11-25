import { AmplifierEventHandler } from '@/ws/handlers/AmplifierEventHandler';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { PollStatus } from '@/database/models/amplifier/poll.interface';
import { SignatureStatus, SignatureType } from '@/database/models/amplifier/signature.interface';
import { PollTrackingJob } from '@/queue/jobs/amplifier/PollTrackingJob';
import { SignatureTrackingJob } from '@/queue/jobs/amplifier/SignatureTrackingJob';
import { AmplifierQueueManager } from '@/queue/queue/AmplifierQueueManager';
import { connectTestDb, disconnectTestDb, cleanupCollections } from '@/utils/test-helpers';
import { VoteType } from '@/database/models/amplifier/poll.interface';
import axios from 'axios';
import { mock } from 'jest-mock-extended';
import mongoose from 'mongoose';

// Mock Bull
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    process: jest.fn(),
    on: jest.fn()
  }));
});

describe('Amplifier Workflow Tests', () => {
  let handler: AmplifierEventHandler;
  let db: AppDb;
  let queryService: AmplifierQueryService;
  let mockQueueManager: AmplifierQueueManager;

  beforeAll(async () => {
    // Ensure database is connected
    if (!mongoose.connection.readyState) {
      await connectTestDb();
    }
    
    const axiosInstance = axios.create({
      baseURL: 'https://lcd-axelar.hoodrun.io',
      timeout: 5000
    });

    db = new AppDb();
    queryService = mock<AmplifierQueryService>({
      getVoteStatus: jest.fn(),
      getSignatureStatus: jest.fn()
    });
    
    // Mock query service methods
    (queryService.getVoteStatus as jest.Mock).mockImplementation((voter: string) => {
      if (voter === 'axelar1') return Promise.resolve(VoteType.YES);
      if (voter === 'axelar2') return Promise.resolve(VoteType.YES);
      return Promise.resolve(VoteType.NO);
    });
    
    (queryService.getSignatureStatus as jest.Mock).mockImplementation((verifier: string) => {
      if (verifier === 'axelar1') return Promise.resolve(SignatureType.YES);
      if (verifier === 'axelar2') return Promise.resolve(SignatureType.YES);
      return Promise.resolve(SignatureType.INVALID);
    });
    
    // Create mock queue manager
    mockQueueManager = mock<AmplifierQueueManager>({
      addPollTrackingJob: jest.fn().mockResolvedValue(undefined),
      addSignatureTrackingJob: jest.fn().mockResolvedValue(undefined)
    });

    handler = new AmplifierEventHandler(db, queryService, mockQueueManager);
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await cleanupCollections();
    jest.clearAllMocks();
  });

  describe('Complete Workflow', () => {
    it('should handle full poll and signature lifecycle', async () => {
      const now = Date.now();
      const expiresAt = now + 3600000; // 1 hour from now

      // 1. Start a new poll
      const pollStartEvent = {
        source_chain: 'ethereum',
        poll_id: 'workflow-poll-1',
        participants: ['axelar1', 'axelar2', 'axelar3'],
        expires_at: expiresAt.toString(),
        height: '1000',
        hash: '0xabc123'
      };

      await handler.handlePollStarted(pollStartEvent);

      // Verify poll creation and tracking job
      let poll = await db.amplifierPollRepo.findByPollId('workflow-poll-1');
      expect(poll).toBeTruthy();
      expect(poll?.status).toBe(PollStatus.PENDING);
      expect(poll?.votes).toHaveLength(3);
      expect(poll?.votes[0].vote).toBe(VoteType.UNSUBMITTED);
      expect(mockQueueManager.addPollTrackingJob).toHaveBeenCalledWith('workflow-poll-1', 1000);

      // 2. Start a signature session
      const signStartEvent = {
        chain: 'ethereum',
        session_id: 'workflow-sig-1',
        _contract_address: '0xdef456',
        pub_keys: {
          axelar1: { ecdsa: 'key1' },
          axelar2: { ecdsa: 'key2' },
          axelar3: { ecdsa: 'key3' }
        },
        verifier_set_id: '789',
        expires_at: expiresAt.toString(),
        height: '1001',
        hash: '0xdef456'
      };

      await handler.handleSigningStarted(signStartEvent);

      // Verify signature session creation and tracking job
      let session = await db.amplifierSignatureRepo.findBySessionId('workflow-sig-1');
      console.log('Initial session:', JSON.stringify(session, null, 2));
      expect(session).toBeTruthy();
      expect(session?.status).toBe(SignatureStatus.PENDING);
      expect(session?.signatures).toBeTruthy();
      expect(session?.signatures).toHaveLength(3);
      expect(session?.signatures[0].status).toBe(SignatureType.UNSUBMITTED);
      expect(mockQueueManager.addSignatureTrackingJob).toHaveBeenCalledWith('workflow-sig-1', 1001);

      // 3. Update votes
      await db.amplifierPollRepo.updateVoteStatus('workflow-poll-1', 'axelar1', VoteType.YES);
      await db.amplifierPollRepo.updateVoteStatus('workflow-poll-1', 'axelar2', VoteType.YES);
      await db.amplifierPollRepo.updateVoteStatus('workflow-poll-1', 'axelar3', VoteType.NO);

      // Verify vote updates
      poll = await db.amplifierPollRepo.findByPollId('workflow-poll-1');
      expect(poll?.votes.find(v => v.voter === 'axelar1')?.vote).toBe(VoteType.YES);
      expect(poll?.votes.find(v => v.voter === 'axelar2')?.vote).toBe(VoteType.YES);
      expect(poll?.votes.find(v => v.voter === 'axelar3')?.vote).toBe(VoteType.NO);

      // 4. Update signatures
      await db.amplifierSignatureRepo.updateSignatureStatus('workflow-sig-1', 'axelar1', SignatureType.YES);
      await db.amplifierSignatureRepo.updateSignatureStatus('workflow-sig-1', 'axelar2', SignatureType.YES);
      await db.amplifierSignatureRepo.updateSignatureStatus('workflow-sig-1', 'axelar3', SignatureType.INVALID);

      // Verify signature updates
      session = await db.amplifierSignatureRepo.findBySessionId('workflow-sig-1');
      console.log('Updated session:', JSON.stringify(session, null, 2));
      expect(session).toBeTruthy();
      expect(session?.signatures).toBeTruthy();
      expect(session?.signatures.length).toBeGreaterThan(0);
      
      const sig1 = session?.signatures.find(s => s.verifier === 'axelar1');
      const sig2 = session?.signatures.find(s => s.verifier === 'axelar2');
      const sig3 = session?.signatures.find(s => s.verifier === 'axelar3');
      
      expect(sig1).toBeTruthy();
      expect(sig2).toBeTruthy();
      expect(sig3).toBeTruthy();
      
      expect(sig1?.status).toBe(SignatureType.YES);
      expect(sig2?.status).toBe(SignatureType.YES);
      expect(sig3?.status).toBe(SignatureType.INVALID);

      // 5. Complete poll
      const pollCompleteEvent = {
        poll_id: 'workflow-poll-1',
        status: 'succeeded_on_source_chain'
      };

      await handler.handlePollCompleted(pollCompleteEvent);

      // Verify poll completion and continued tracking
      poll = await db.amplifierPollRepo.findByPollId('workflow-poll-1');
      expect(poll?.status).toBe(PollStatus.COMPLETED);
      expect(mockQueueManager.addPollTrackingJob).toHaveBeenCalledTimes(2);

      // 6. Complete signature session
      const sigCompleteEvent = {
        session_id: 'workflow-sig-1'
      };

      await handler.handleSigningCompleted(sigCompleteEvent);

      // Verify signature completion and continued tracking
      session = await db.amplifierSignatureRepo.findBySessionId('workflow-sig-1');
      expect(session?.status).toBe(SignatureStatus.COMPLETED);
      expect(mockQueueManager.addSignatureTrackingJob).toHaveBeenCalledTimes(2);

      // Process tracking jobs to update lastChecked timestamps
      await new PollTrackingJob(db, queryService).process({
        data: { pollId: 'workflow-poll-1', currentHeight: 1000 },
        opts: {}
      } as any);

      await new SignatureTrackingJob(db, queryService).process({
        data: { sessionId: 'workflow-sig-1', currentHeight: 1000 },
        opts: {}
      } as any);

      // Verify final states
      poll = await db.amplifierPollRepo.findByPollId('workflow-poll-1');
      session = await db.amplifierSignatureRepo.findBySessionId('workflow-sig-1');

      expect(poll?.votes.every(v => v.lastChecked)).toBeTruthy();
      expect(session?.signatures.every(s => s.lastChecked)).toBeTruthy();
    });
  });
});
