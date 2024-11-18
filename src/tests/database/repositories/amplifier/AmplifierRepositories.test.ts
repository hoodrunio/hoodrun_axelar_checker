import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { AmplifierPollRepository } from '@/repositories/amplifier/AmplifierPollRepository';
import { AmplifierSignatureRepository } from '@/repositories/amplifier/AmplifierSignatureRepository';

describe('Amplifier Repositories Tests', () => {
  let mongoServer: MongoMemoryServer;
  let connection: MongoClient;
  let db: Db;
  let pollRepo: AmplifierPollRepository;
  let signatureRepo: AmplifierSignatureRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    connection = await MongoClient.connect(mongoServer.getUri());
    db = connection.db('testdb');
    pollRepo = new AmplifierPollRepository();
    signatureRepo = new AmplifierSignatureRepository();
  });

  afterAll(async () => {
    await connection.close();
    await mongoServer.stop();
  });

  describe('AmplifierPollRepository', () => {
    it('should create and find a poll', async () => {
      const pollData = {
        pollId: 'test-poll-1',
        sourceChain: 'ethereum',
        participants: ['validator1', 'validator2'],
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x123',
        status: 'Pending' as const,
        votes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await pollRepo.create(pollData);
      const found = await pollRepo.findByPollId(pollData.pollId);
      
      expect(found).toBeTruthy();
      expect(found?.pollId).toBe(pollData.pollId);
    });

    // Add more tests...
  });

  describe('AmplifierSignatureRepository', () => {
    it('should create and find a signature session', async () => {
      const signatureData = {
        sessionId: 'test-session-1',
        chain: 'ethereum',
        contractAddress: '0x456',
        pubKeys: [{ address: 'validator1', ecdsaKey: 'key1' }],
        verifierSetId: 'set1',
        expiresAt: Date.now() + 3600000,
        height: 1000,
        hash: '0x789',
        status: 'Pending' as const,
        signatures: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await signatureRepo.create(signatureData);
      const found = await signatureRepo.findBySessionId(signatureData.sessionId);
      
      expect(found).toBeTruthy();
      expect(found?.sessionId).toBe(signatureData.sessionId);
    });

    // Add more tests...
  });
}); 