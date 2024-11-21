import { connectTestDb, disconnectTestDb, cleanupCollections } from '@/utils/test-helpers';
import { AmplifierPollRepository } from '@/repositories/amplifier/AmplifierPollRepository';
import { AmplifierSignatureRepository } from '@/repositories/amplifier/AmplifierSignatureRepository';
import mongoose from 'mongoose';
import { PollStatus, VoteType } from '@/database/models/amplifier/poll.interface';
import { SignatureStatus, SignatureType } from '@/database/models/amplifier/signature.interface';

describe('Amplifier Repositories Tests', () => {
  let pollRepo: AmplifierPollRepository;
  let signatureRepo: AmplifierSignatureRepository;

  beforeAll(async () => {
    await connectTestDb();
    pollRepo = new AmplifierPollRepository();
    signatureRepo = new AmplifierSignatureRepository();
    await cleanupCollections();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('AmplifierPollRepository', () => {
    it('should create and find a poll', async () => {
      const pollData = {
        pollId: '53',
        sourceChain: 'stellar',
        participants: ['axelar1', 'axelar12'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      const created = await pollRepo.create(pollData);
      expect(created).toBeTruthy();
      expect(created.pollId).toBe(pollData.pollId);

      const found = await pollRepo.findByPollId(pollData.pollId);
      expect(found).toBeTruthy();
      expect(found?.pollId).toBe(pollData.pollId);
    });

    it('should update vote status', async () => {
      const pollData = {
        pollId: '54',
        sourceChain: 'stellar',
        participants: ['axelar1', 'axelar12'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      await pollRepo.create(pollData);
      await pollRepo.updateVoteStatus(pollData.pollId, 'axelar1', VoteType.YES);

      const updated = await pollRepo.findByPollId(pollData.pollId);
      expect(updated?.votes[0].voter).toBe('axelar1');
      expect(updated?.votes[0].vote).toBe(VoteType.YES);
    });

    it('should handle multiple votes from same voter', async () => {
      const pollData = {
        pollId: '56',
        sourceChain: 'stellar',
        participants: ['axelar1', 'axelar12'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      await pollRepo.create(pollData);
      await pollRepo.updateVoteStatus(pollData.pollId, 'axelar1', VoteType.NO);
      await pollRepo.updateVoteStatus(pollData.pollId, 'axelar1', VoteType.YES);

      const updated = await pollRepo.findByPollId(pollData.pollId);
      expect(updated?.votes.length).toBe(1);
      expect(updated?.votes[0].voter).toBe('axelar1');
      expect(updated?.votes[0].vote).toBe(VoteType.YES);
    });

    it('should update poll status', async () => {
      const pollData = {
        pollId: '57',
        sourceChain: 'stellar',
        participants: ['axelar1', 'axelar12'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      await pollRepo.create(pollData);
      await pollRepo.updatePollStatus(pollData.pollId, PollStatus.COMPLETED);

      const updated = await pollRepo.findByPollId(pollData.pollId);
      expect(updated?.status).toBe(PollStatus.COMPLETED);
    });
  });

  describe('AmplifierSignatureRepository', () => {
    it('should create and find a signature session', async () => {
      const signatureData = {
        sessionId: '55',
        chain: 'stellar',
        contractAddress: '0x456',
        pubKeys: [{ address: 'axelar1', ecdsaKey: 'key1' }],
        verifierSetId: 'set1',
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x789',
        status: SignatureStatus.PENDING,
        signatures: []
      };

      const created = await signatureRepo.create(signatureData);
      console.log('Created signature:', created);

      expect(created).toBeTruthy();
      expect(created.sessionId).toBe(signatureData.sessionId);

      const found = await signatureRepo.findBySessionId(signatureData.sessionId);
      console.log('Found signature:', found);
      
      expect(found).toBeTruthy();
      expect(found?.sessionId).toBe(signatureData.sessionId);
    });

    it('should update signature status', async () => {
      const signatureData = {
        sessionId: '56',
        chain: 'stellar',
        contractAddress: '0x456',
        pubKeys: [{ address: 'axelar1', ecdsaKey: 'key1' }],
        verifierSetId: 'set1',
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x789',
        status: SignatureStatus.PENDING,
        signatures: []
      };

      const created = await signatureRepo.create(signatureData);
      await signatureRepo.updateStatus(created.sessionId, SignatureStatus.COMPLETED);

      const updated = await signatureRepo.findBySessionId(created.sessionId);
      expect(updated?.status).toBe(SignatureStatus.COMPLETED);
    });

    it('should handle non-existent session', async () => {
      const nonExistentId = 'non-existent-id';
      const found = await signatureRepo.findBySessionId(nonExistentId);
      expect(found).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate poll creation', async () => {
      const pollData = {
        pollId: '58',
        sourceChain: 'stellar',
        participants: ['axelar1'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      await pollRepo.create(pollData);
      
      // Aynı pollId ile tekrar oluşturmayı dene
      await expect(pollRepo.create(pollData)).rejects.toThrow();
    });

    it('should handle invalid status updates', async () => {
      const pollData = {
        pollId: '59',
        sourceChain: 'stellar',
        participants: ['axelar1'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: PollStatus.PENDING,
        votes: []
      };

      await pollRepo.create(pollData);
      
      // @ts-expect-error - Geçersiz durum testi
      await expect(pollRepo.updatePollStatus(pollData.pollId, SignatureType.INVALID))
        .rejects.toThrow();
    });
  });
}); 