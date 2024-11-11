import axios from 'axios';
import { AmplifierEventHandler } from '../../ws/handlers/AmplifierEventHandler';
import { AmplifierVoteChecker } from '../../services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '../../services/amplifier/AmplifierVerifierService';
import { AmplifierPollRepository } from '@repositories/amplifier/AmplifierPollRepository';
import { AmplifierVoteRepository } from '@repositories/amplifier/AmplifierVoteRepository';
import { AmplifierPollState } from '@database/models/amplifier/interfaces';
import Bull from 'bull';
import { AppDb } from '@database/database';

describe('Amplifier Process Real Data Integration Test', () => { 
  let eventHandler: AmplifierEventHandler;
  let voteChecker: AmplifierVoteChecker;
  let verifierService: AmplifierVerifierService;
  let amplifierPollRepo: AmplifierPollRepository;
  let amplifierVoteRepo: AmplifierVoteRepository;
  let voteCheckQueue: Bull.Queue;
  let db: AppDb;

  beforeAll(async () => {
    db = new AppDb();
    amplifierPollRepo = db.amplifierPollRepo;
    amplifierVoteRepo = db.amplifierVoteRepo;

    // Gerçek bir doğrulayıcı adresi kullanın
    verifierService = AmplifierVerifierService.getInstance();
    process.env.VERIFIER_ADDRESS = 'axelar104jgwmkat4xn2800r6yd44djjhgw2ejrjvqkaj';

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

  it('should process real block data and handle events', async () => {
    // Test edilecek gerçek blok
    const blockHeight = '15333938';
    const blockUrl = `https://axelar-rpc.qubelabs.io:443/block?height=${blockHeight}`;

    try {
      // Blok verisini al
      const blockResponse = await axios.get(blockUrl);
      expect(blockResponse.status).toBe(200);
      
      const blockData = blockResponse.data.result;
      const txs = blockData.block.data.txs;
      
      console.log(`Processing ${txs.length} transactions from block ${blockHeight}`);

      for (const txBase64 of txs) {
        // Base64 transaction'ı çöz
        const txBuffer = Buffer.from(txBase64, 'base64');
        const txString = txBuffer.toString('hex');
        
        // Transaction detaylarını al
        const txResponse = await axios.get(
          `https://axelar-rpc.qubelabs.io:443/tx?hash=0x${txString}`
        );
        
        const events = txResponse.data.result.tx_result.events;
        
        for (const event of events) {
          if (event.type === 'wasm-messages_poll_started') {
            console.log('Found poll_started event, processing...');
            
            // Event'i işle
            await eventHandler.handleEvent(event);
            
            // Poll'un kaydedildiğini doğrula
            const decodedAttributes = eventHandler.decoder.decodePollAttributes(event.attributes);
            const poll = await amplifierPollRepo.findOne({ 
              pollId: decodedAttributes.pollId 
            });
            
            expect(poll).not.toBeNull();
            expect(poll?.pollState).toBe(AmplifierPollState.ACTIVE);
            
            // Her katılımcı için oy durumunu kontrol et
            for (const participant of decodedAttributes.participants) {
              const voteStatus = await voteChecker.checkVoteStatus(decodedAttributes.pollId);
              const txInfo = await voteChecker.getVoteTxInfo(participant, decodedAttributes.pollId);
              
              // Oy durumunu güncelle
              await amplifierVoteRepo.updateVoteStatus(
                `${decodedAttributes.pollId}_${participant}`,
                voteStatus,
                txInfo || { txHash: '', txHeight: 0 }
              );
              
              // Güncellenen oyu doğrula
              const vote = await amplifierVoteRepo.findOne({
                customId: `${decodedAttributes.pollId}_${participant}`
              });
              
              expect(vote).not.toBeNull();
              console.log(`Vote status for participant ${participant}: ${vote?.vote}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
}); 