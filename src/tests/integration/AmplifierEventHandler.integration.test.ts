import { AmplifierEventHandler } from '@/ws/handlers/AmplifierEventHandler';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config } from 'dotenv';
import axios from 'axios';
import { PollStatus } from '@/database/models/amplifier/poll.interface';
import { SignatureStatus } from '@/database/models/amplifier/signature.interface';

config();

describe('AmplifierEventHandler Integration Tests', () => {
  let handler: AmplifierEventHandler;
  let db: AppDb;
  let queryService: AmplifierQueryService;
  let axiosInstance: ReturnType<typeof axios.create>;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // MongoDB Memory Server başlat
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Memory Server'a bağlan
    await mongoose.connect(mongoUri);
    
    // Axios instance'ı oluştur
    axiosInstance = axios.create({
      baseURL: "https://lcd-axelar.hoodrun.io",
      timeout: 5000
    });

    db = new AppDb();
    queryService = new AmplifierQueryService(axiosInstance, "https://lcd-axelar.hoodrun.io");
    handler = new AmplifierEventHandler(db, queryService);
  });

  afterAll(async () => {
    // Bağlantıları kapat
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Her test öncesi koleksiyonları temizle
    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  });

  describe('Poll Events Integration', () => {
    it('should process real poll started event correctly', async () => {
      const realPollEvent = {
        source_chain: "eth-sepolia",
        poll_id: "164",
        participants: [
          "axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y",
          "axelar1d30v0rf8pwm3vma9h2ms72vlk7zjfvpk3ecgl4",
          "axelar19xly5upgdf48wrrr83yk6v8exsmnyqprmqzj4z"
        ],
        expires_at: "4078821",
        height: "4078811",
        hash: "324D4C552F8B2A4E49653E91973BA8D87B835073AEB64F5B361E2F970C1AAAAC"
      };

      await handler.handlePollStarted(realPollEvent);

      const savedPoll = await db.amplifierPollRepo.findByPollId("164");
      expect(savedPoll).toBeTruthy();
      expect(savedPoll?.sourceChain).toBe("eth-sepolia");
      expect(savedPoll?.participants).toHaveLength(3);
      expect(savedPoll?.status).toBe(PollStatus.PENDING);
      expect(savedPoll?.votes).toHaveLength(3);
    });

    it('should process real poll completed event correctly', async () => {
      const pollData = {
        pollId: "164",
        sourceChain: "eth-sepolia",
        participants: ["axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y"],
        expiresAt: Number("4078821"),
        height: Number("4078811"),
        hash: "324D4C552F8B2A4E49653E91973BA8D87B835073AEB64F5B361E2F970C1AAAAC",
        status: PollStatus.PENDING,
        votes: []
      };
      await db.amplifierPollRepo.create(pollData);

      const realPollCompletedEvent = {
        poll_id: "164",
        status: "not_found_on_source_chain"
      };

      await handler.handlePollCompleted(realPollCompletedEvent);

      const updatedPoll = await db.amplifierPollRepo.findByPollId("164");
      expect(updatedPoll?.status).toBe(PollStatus.FAILED);
    });
  });

  describe('Signature Events Integration', () => {
    it('should process real signing started event correctly', async () => {
      const realSigningEvent = {
        chain: "avalanche-fuji",
        session_id: "2159",
        _contract_address: "axelar19jxy26z0qnnspa45y5nru0l5rmy9d637z5km2ndjxthfxf5qaswst9290r",
        pub_keys: {
          "axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y": {
            "ecdsa": "03ae2cee8567997e88db024267e0776f5f72c6da3bd61c28c4b5446482b7d6cdc9"
          }
        },
        verifier_set_id: "23b68feb94699d32d762ad7264d416d5324408018f9ecd172a3aadd38a255c36",
        expires_at: "4073996",
        height: "4073986",
        hash: "2E59170F5E2C123F4381534F404C9CDCFDAA966DE819EDBA3586FB3E394294CB"
      };

      await handler.handleSigningStarted(realSigningEvent);

      const savedSignature = await db.amplifierSignatureRepo.findBySessionId("2159");
      expect(savedSignature).toBeTruthy();
      expect(savedSignature?.chain).toBe("avalanche-fuji");
      expect(savedSignature?.pubKeys).toHaveLength(1);
      expect(savedSignature?.status).toBe(SignatureStatus.PENDING);
      expect(savedSignature?.signatures).toHaveLength(1);
    });

    it('should process real signing completed event correctly', async () => {
      const signatureData = {
        sessionId: "2159",
        chain: "avalanche-fuji",
        contractAddress: "axelar19jxy26z0qnnspa45y5nru0l5rmy9d637z5km2ndjxthfxf5qaswst9290r",
        pubKeys: [{
          address: "axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y",
          ecdsaKey: "03ae2cee8567997e88db024267e0776f5f72c6da3bd61c28c4b5446482b7d6cdc9"
        }],
        verifierSetId: "23b68feb94699d32d762ad7264d416d5324408018f9ecd172a3aadd38a255c36",
        expiresAt: Number("4073996"),
        height: Number("4073986"),
        hash: "2E59170F5E2C123F4381534F404C9CDCFDAA966DE819EDBA3586FB3E394294CB",
        status: SignatureStatus.PENDING,
        signatures: []
      };
      await db.amplifierSignatureRepo.create(signatureData);

      const realSigningCompletedEvent = {
        session_id: "2159",
        chain: "avalanche-fuji",
        completed_at: "4078821"
      };

      await handler.handleSigningCompleted(realSigningCompletedEvent);

      const updatedSignature = await db.amplifierSignatureRepo.findBySessionId("2159");
      expect(updatedSignature?.status).toBe(SignatureStatus.COMPLETED);
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate poll events correctly', async () => {
      const duplicatePollEvent = {
        source_chain: "eth-sepolia",
        poll_id: "164",
        participants: ["axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y"],
        expires_at: "4078821",
        height: "4078811",
        hash: "324D4C552F8B2A4E49653E91973BA8D87B835073AEB64F5B361E2F970C1AAAAC"
      };

      // İlk deneme
      await handler.handlePollStarted(duplicatePollEvent);
      const firstAttempt = await db.amplifierPollRepo.findByPollId("164");

      // İkinci deneme
      await handler.handlePollStarted(duplicatePollEvent);
      const secondAttempt = await db.amplifierPollRepo.findByPollId("164");

      expect(firstAttempt?.createdAt).toEqual(secondAttempt?.createdAt);
    });

    it('should handle malformed events gracefully', async () => {
      const malformedEvent = {
        source_chain: "eth-sepolia",
        // poll_id eksik
        participants: []
      };

      await expect(handler.handlePollStarted(malformedEvent))
        .rejects.toThrow('Invalid event format');
    });
  });
}); 