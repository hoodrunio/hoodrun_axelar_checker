import { AmplifierEventHandler } from '@/ws/handlers/AmplifierEventHandler';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { AmplifierQueueManager } from '@/queue/queue/AmplifierQueueManager';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { PollStatus, VoteType } from '@/database/models/amplifier/poll.interface';
import { SignatureStatus, SignatureType } from '@/database/models/amplifier/signature.interface';
import axios from 'axios';
import { mock } from 'jest-mock-extended';

// Mock Bull
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
    process: jest.fn(),
    on: jest.fn()
  }));
});

describe('AmplifierEventHandler Integration Tests', () => {
  let handler: AmplifierEventHandler;
  let db: AppDb;
  let queryService: AmplifierQueryService;
  let mongoServer: MongoMemoryServer;
  let axiosInstance: ReturnType<typeof axios.create>;
  let mockQueueManager: AmplifierQueueManager;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    axiosInstance = axios.create({
      baseURL: 'https://lcd-axelar.hoodrun.io',
      timeout: 5000
    });

    db = new AppDb();
    queryService = new AmplifierQueryService(axiosInstance, 'https://lcd-axelar.hoodrun.io');

    // Mock QueueManager
    mockQueueManager = mock<AmplifierQueueManager>({
      addPollTrackingJob: jest.fn().mockResolvedValue(undefined),
      addSignatureTrackingJob: jest.fn().mockResolvedValue(undefined)
    });

    // Pass mockQueueManager to handler
    handler = new AmplifierEventHandler(db, queryService, mockQueueManager);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
    
    // Reset mock calls
    jest.clearAllMocks();
  });

  describe('Poll Event Integration', () => {
    const pollStartEvent = {
      source_chain: 'ethereum',
      poll_id: 'test-poll-123',
      participants: ['axelar1test1', 'axelar1test2'],
      expires_at: '1000',
      height: '500',
      hash: '0xabc123'
    };

    it('should handle complete poll lifecycle', async () => {
      // 1. Poll başlatma
      await handler.handlePollStarted(pollStartEvent);

      // DB'den poll'u kontrol et
      const createdPoll = await db.amplifierPollRepo.findByPollId('test-poll-123');
      expect(createdPoll).toBeTruthy();
      expect(createdPoll?.status).toBe(PollStatus.PENDING);
      expect(createdPoll?.votes).toHaveLength(2);
      expect(createdPoll?.votes[0].vote).toBe(VoteType.UNSUBMITTED);

      // Queue job'ının eklendiğini kontrol et
      expect(mockQueueManager.addPollTrackingJob).toHaveBeenCalledWith('test-poll-123', 500);

      // 2. Poll tamamlama
      const completionEvent = {
        poll_id: 'test-poll-123',
        status: 'succeeded_on_source_chain'
      };
      await handler.handlePollCompleted(completionEvent);

      // Güncellenmiş poll'u kontrol et
      const completedPoll = await db.amplifierPollRepo.findByPollId('test-poll-123');
      expect(completedPoll?.status).toBe(PollStatus.COMPLETED);
    });

    it('should handle duplicate poll events', async () => {
      // İlk kez oluştur
      await handler.handlePollStarted(pollStartEvent);
      const firstPoll = await db.amplifierPollRepo.findByPollId('test-poll-123');

      // Aynı event'i tekrar gönder
      await handler.handlePollStarted(pollStartEvent);
      const secondPoll = await db.amplifierPollRepo.findByPollId('test-poll-123');

      // Aynı poll ID'ye sahip tek bir kayıt olmalı
      expect(firstPoll?.pollId).toBe(secondPoll?.pollId);
      const pollCount = await db.amplifierPollRepo.count({ pollId: 'test-poll-123' });
      expect(pollCount).toBe(1);
    });
  });

  describe('Signature Event Integration', () => {
    const signStartEvent = {
      chain: 'ethereum',
      session_id: 'test-session-456',
      _contract_address: '0xdef456',
      pub_keys: {
        'axelar1test1': { ecdsa: 'key1' },
        'axelar1test2': { ecdsa: 'key2' }
      },
      verifier_set_id: '789',
      expires_at: '2000',
      height: '600',
      hash: '0xghi789'
    };

    it('should handle complete signature lifecycle', async () => {
      // 1. Signature session başlatma
      await handler.handleSigningStarted(signStartEvent);

      // DB'den session'ı kontrol et
      const createdSession = await db.amplifierSignatureRepo.findBySessionId('test-session-456');
      expect(createdSession).toBeTruthy();
      expect(createdSession?.status).toBe(SignatureStatus.PENDING);
      expect(createdSession?.signatures).toHaveLength(2);
      expect(createdSession?.signatures[0].status).toBe(SignatureType.UNSUBMITTED);

      // 2. Signature tamamlama
      const completionEvent = {
        session_id: 'test-session-456'
      };
      await handler.handleSigningCompleted(completionEvent);

      // Güncellenmiş session'ı kontrol et
      const completedSession = await db.amplifierSignatureRepo.findBySessionId('test-session-456');
      expect(completedSession?.status).toBe(SignatureStatus.COMPLETED);
    });

    it('should handle error scenarios gracefully', async () => {
      // Geçersiz event formatı
      const invalidEvent = {
        chain: 'ethereum'
        // Eksik alanlar
      };

      await expect(handler.handleSigningStarted(invalidEvent))
        .rejects
        .toThrow('Invalid event format');

      // DB'de hiçbir kayıt oluşturulmamalı
      const sessionCount = await db.amplifierSignatureRepo.count({});
      expect(sessionCount).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection issues', async () => {
      // Veritabanı bağlantısını geçici olarak kes
      await mongoose.disconnect();

      const pollStartEvent = {
        source_chain: 'ethereum',
        poll_id: 'test-poll-789',
        participants: ['axelar1test1'],
        expires_at: '1000',
        height: '500',
        hash: '0xabc789'
      };

      // İşlem hata vermeli
      await expect(handler.handlePollStarted(pollStartEvent)).rejects.toThrow();

      // Bağlantıyı geri yükle
      await mongoose.connect(mongoServer.getUri());

      // Şimdi işlem başarılı olmalı
      await handler.handlePollStarted(pollStartEvent);
      const poll = await db.amplifierPollRepo.findByPollId('test-poll-789');
      expect(poll).toBeTruthy();
    });
  });
}); 