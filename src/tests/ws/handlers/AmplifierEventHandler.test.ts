import { AmplifierEventHandler } from '@/ws/handlers/AmplifierEventHandler';
import { AppDb } from '@/database/database';
import { AmplifierQueryService } from '@/services/rest/AmplifierQueryService';
import { AmplifierPollRepository } from '@/repositories/amplifier/AmplifierPollRepository';
import { AmplifierSignatureRepository } from '@/repositories/amplifier/AmplifierSignatureRepository';

describe('AmplifierEventHandler', () => {
  let handler: AmplifierEventHandler;
  let mockDb: jest.Mocked<AppDb>;
  let mockQueryService: jest.Mocked<AmplifierQueryService>;
  let mockAmplifierPollRepo: jest.Mocked<AmplifierPollRepository>;
  let mockAmplifierSignatureRepo: jest.Mocked<AmplifierSignatureRepository>;

  beforeEach(() => {
    // Mock repository'leri oluştur
    mockAmplifierPollRepo = {
      findByPollId: jest.fn(),
      create: jest.fn(),
      updateVoteStatus: jest.fn(),
      updatePollStatus: jest.fn(),
    } as any;

    mockAmplifierSignatureRepo = {
      findBySessionId: jest.fn(),
      create: jest.fn(),
      updateSignatureStatus: jest.fn(),
      updateStatus: jest.fn(),
    } as any;

    // AppDb mock'unu oluştur
    mockDb = {
      amplifierPollRepo: mockAmplifierPollRepo,
      amplifierSignatureRepo: mockAmplifierSignatureRepo,
    } as any;

    // QueryService mock'unu oluştur
    mockQueryService = {
      getVoteStatus: jest.fn(),
      getSignatureStatus: jest.fn(),
    } as any;

    handler = new AmplifierEventHandler(mockDb, mockQueryService);
  });

  describe('handlePollStarted', () => {
    const pollStartedEvent = {
      source_chain: 'ethereum',
      poll_id: '123',
      participants: ['axelar1', 'axelar2'],
      expires_at: 1000,
      height: 500,
      hash: '0xabc'
    };

    it('should create new poll and check votes', async () => {
      // Mock davranışlarını ayarla
      mockAmplifierPollRepo.findByPollId.mockResolvedValue(null);
      mockQueryService.getVoteStatus.mockResolvedValue('Unsubmitted');

      await handler.handlePollStarted(pollStartedEvent);

      expect(mockAmplifierPollRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        pollId: '123',
        sourceChain: 'ethereum',
        status: 'Pending'
      }));
      expect(mockQueryService.getVoteStatus).toHaveBeenCalledTimes(2);
    });

    it('should skip if poll already exists', async () => {
      mockAmplifierPollRepo.findByPollId.mockResolvedValue({
        pollId: '123',
        sourceChain: 'ethereum',
        status: 'Pending'
      } as any);

      await handler.handlePollStarted(pollStartedEvent);

      expect(mockAmplifierPollRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('handlePollCompleted', () => {
    it('should handle not_found_on_source_chain status', async () => {
      const event = {
        poll_id: '164',
        status: 'not_found_on_source_chain'
      };
      
      await handler.handlePollCompleted(event);
      
      expect(mockAmplifierPollRepo.updatePollStatus)
        .toHaveBeenCalledWith('164', 'Failed');
    });

    it('should handle succeeded_on_source_chain status', async () => {
      const event = {
        poll_id: '164',
        status: 'succeeded_on_source_chain'
      };
      
      await handler.handlePollCompleted(event);
      
      expect(mockAmplifierPollRepo.updatePollStatus)
        .toHaveBeenCalledWith('164', 'Completed');
    });
  });

  describe('handleSigningStarted', () => {
    const signingStartedEvent = {
      chain: 'avalanche-fuji',
      session_id: '2159',
      pub_keys: {
        'axelar1vtducwafe07uhh2lfkr7xye6szk5plxtcufj6y': {
          ecdsa: '03ae2cee8567997e88db024267e0776f5f72c6da3bd61c28c4b5446482b7d6cdc9'
        }
      },
      expires_at: '4073996',
      verifier_set_id: '23b68feb94699d32d762ad7264d416d5324408018f9ecd172a3aadd38a255c36',
      _contract_address: 'axelar19jxy26z0qnnspa45y5nru0l5rmy9d637z5km2ndjxthfxf5qaswst9290r',
      height: '4073986',
      hash: '2E59170F5E2C123F4381534F404C9CDCFDAA966DE819EDBA3586FB3E394294CB'
    };

    it('should create new signature session', async () => {
      // Mock fonksiyonlarını ayarla
      mockAmplifierSignatureRepo.findBySessionId.mockResolvedValue(null);
      mockQueryService.getSignatureStatus.mockResolvedValue('Unsubmitted');

      await handler.handleSigningStarted(signingStartedEvent);

      expect(mockAmplifierSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: '2159',
          chain: 'avalanche-fuji',
          status: 'Pending'
        })
      );
    });

    it('should skip if signature session already exists', async () => {
      mockAmplifierSignatureRepo.findBySessionId.mockResolvedValue({
        sessionId: '2159',
        chain: 'avalanche-fuji',
        status: 'Pending'
      } as any);

      await handler.handleSigningStarted(signingStartedEvent);

      expect(mockAmplifierSignatureRepo.create).not.toHaveBeenCalled();
    });

    it('should handle invalid event format', async () => {
      const invalidEvent = { chain: 'avalanche-fuji' };
      await expect(handler.handleSigningStarted(invalidEvent as any))
        .rejects.toThrow('Invalid event format');
    });
  });
}); 