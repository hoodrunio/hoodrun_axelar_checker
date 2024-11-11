import { AmplifierVoteChecker } from '../../services/amplifier/AmplifierVoteChecker';
import { AmplifierEventHandler } from '../../ws/handlers/AmplifierEventHandler';
import { AmplifierPollRepository } from '@repositories/amplifier/AmplifierPollRepository';
import { AmplifierVoteRepository } from '@repositories/amplifier/AmplifierVoteRepository';
import { AmplifierVoteType } from '../../types/amplifier';
import { AmplifierPollState } from '@database/models/amplifier/interfaces';
import { AppDb } from '@database/database';
import axios from 'axios';
import Bull from 'bull';

describe('Amplifier Vote Module Integration Tests', () => {
  let voteChecker: AmplifierVoteChecker;
  let eventHandler: AmplifierEventHandler;
  let amplifierPollRepo: AmplifierPollRepository;
  let amplifierVoteRepo: AmplifierVoteRepository;
  let voteCheckQueue: Bull.Queue;
  let db: AppDb;

  beforeAll(async () => {
    db = new AppDb();
    amplifierPollRepo = db.amplifierPollRepo;
    amplifierVoteRepo = db.amplifierVoteRepo;

    const axiosInstance = axios.create({
      baseURL: 'https://axelar-rpc.qubelabs.io:443'
    });

    voteChecker = new AmplifierVoteChecker(axiosInstance);
    voteCheckQueue = new Bull('voteCheckQueue', {
      redis: { port: 6379, host: '127.0.0.1' }
    });
    eventHandler = new AmplifierEventHandler(voteCheckQueue);
  });

  afterAll(async () => {
    await voteCheckQueue.close();
    await db.close();
  });

  describe('Vote Status Check Tests', () => {
    it('should correctly identify YES vote', async () => {
      const pollId = '47';
      const voterAddress = 'axelar15k8d4hqgytdxmcx3lhph2qagvt0r7683cchglj';
      
      const voteStatus = await voteChecker.checkVoteStatus(pollId);
      const txInfo = await voteChecker.getVoteTxInfo(voterAddress, pollId);
      
      expect(voteStatus).toBe(AmplifierVoteType.YES);
      expect(txInfo).toHaveProperty('txHash');
      expect(txInfo?.txHeight).toBeGreaterThan(0);
    });

    it('should correctly identify NO vote', async () => {
      const pollId = '46';
      const voterAddress = 'axelar1nppcln...'; // Use a known NO voter
      
      const voteStatus = await voteChecker.checkVoteStatus(pollId);
      const txInfo = await voteChecker.getVoteTxInfo(voterAddress, pollId);
      
      expect(voteStatus).toBe(AmplifierVoteType.NO);
    });

    it('should handle UNSUBMITTED vote correctly', async () => {
      const pollId = '45';
      const voterAddress = 'axelar1abc...'; // Use an address that hasn't voted
      
      const voteStatus = await voteChecker.checkVoteStatus(pollId);
      const txInfo = await voteChecker.getVoteTxInfo(voterAddress, pollId);
      
      expect(voteStatus).toBe(AmplifierVoteType.UNSUBMITTED);
      expect(txInfo).toBeUndefined();
    });
  });

  describe('Poll State Transition Tests', () => {
    it('should transition poll state to COMPLETED on quorum reached', async () => {
      const pollId = '47';
      const blockHeight = '15333939';
      
      // Get block with quorum_reached event
      const response = await axios.get(
        `https://axelar-rpc.qubelabs.io:443/block_results?height=${blockHeight}`
      );
      
      const events = response.data.result.txs_results[0].events;
      const quorumEvent = events.find(
        (e: any) => e.type === 'wasm-quorum_reached'
      );
      
      await eventHandler.handleEvent(quorumEvent);
      
      const poll = await amplifierPollRepo.findOne({ pollId });
      expect(poll?.pollState).toBe(AmplifierPollState.COMPLETED);
    });

    it('should handle poll expiration correctly', async () => {
      const pollId = '44';
      const expiresAt = Math.floor(Date.now() / 1000) - 1000; // Expired timestamp
      
      await amplifierPollRepo.create({
        pollId,
        pollState: AmplifierPollState.ACTIVE,
        expiresAt,
        messages: [],
        contractAddress: 'mock-contract',
        sourceGatewayAddress: 'mock-gateway',
        txHash: 'mock-tx-hash',
        sourceChain: 'ethereum',
        participants: [],
        confirmationHeight: 0,
        txHeight: 1000
      });
      
      await voteChecker.checkPollExpiration(pollId);
      
      const poll = await amplifierPollRepo.findOne({ pollId });
      expect(poll?.pollState).toBe(AmplifierPollState.FAILED);
    });
  });

  describe('Event Processing Tests', () => {
    it('should process poll_started event and create database records', async () => {
      // Test implementation
    });

    it('should handle multiple votes from different participants', async () => {
      // Test implementation
    });
  });
}); 