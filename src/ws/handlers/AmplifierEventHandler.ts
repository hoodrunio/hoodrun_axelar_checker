import { AppDb } from "@/database/database";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { AmplifierQueueManager } from "@/queue/queue/AmplifierQueueManager";
import { logger } from "@/utils/logger";
import { 
  IAmplifierPoll, 
  PollStartedEvent,
  PollStatus,
  VoteType
} from "@/database/models/amplifier/poll.interface";
import { 
  IAmplifierSignature, 
  SigningStartedEvent,
  SignatureStatus,
  SignatureType
} from "@/database/models/amplifier/signature.interface";

// Type guard fonksiyonları
function isPollStartedEvent(event: unknown): event is PollStartedEvent {
  const e = event as PollStartedEvent;
  return (
    typeof e?.source_chain === 'string' &&
    typeof e?.poll_id === 'string' &&
    Array.isArray(e?.participants) &&
    typeof e?.expires_at !== 'undefined' &&
    typeof e?.height !== 'undefined' &&
    typeof e?.hash === 'string'
  );
}

function isSigningStartedEvent(event: unknown): event is SigningStartedEvent {
  const e = event as SigningStartedEvent;
  return (
    typeof e?.chain === 'string' &&
    typeof e?.session_id === 'string' &&
    typeof e?._contract_address === 'string' &&
    typeof e?.pub_keys === 'object' &&
    e?.pub_keys !== null &&
    typeof e?.verifier_set_id === 'string' &&
    typeof e?.expires_at !== 'undefined' &&
    typeof e?.height !== 'undefined' &&
    typeof e?.hash === 'string'
  );
}

export class AmplifierEventHandler {
  private readonly logger: typeof logger;
  private readonly queueManager: AmplifierQueueManager;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService,
    queueManager?: AmplifierQueueManager
  ) {
    this.logger = logger;
    this.queueManager = queueManager || new AmplifierQueueManager(db, queryService);
  }

  async handlePollStarted(event: unknown): Promise<void> {
    if (!isPollStartedEvent(event)) {
      this.logger.error('Invalid poll started event format');
      throw new Error('Invalid event format');
    }

    try {
      const pollId = event.poll_id.replace(/"/g, '');

      // Poll'u oluştur ve sonucu kullan
      const pollData = await this.createPoll(event);
      if (!pollData) {
        throw new Error(`Failed to create poll for ${pollId}`);
      }
      
      // Queue'ya tracking job ekle
      await this.queueManager.addPollTrackingJob(pollId, Number(event.height));
      
      this.logger.info(`Poll ${pollId} created with status ${pollData.status} and tracking job added`);
    } catch (error) {
      this.logger.error('Error handling poll started event:', error);
      throw error;
    }
  }

  async handleSigningStarted(event: unknown): Promise<void> {
    if (!isSigningStartedEvent(event)) {
      this.logger.error('Invalid signing started event format');
      throw new Error('Invalid event format');
    }

    try {
      const sessionId = event.session_id;

      // Signature session'ı oluştur ve sonucu kullan
      const signatureData = await this.createSignatureSession(event);
      if (!signatureData) {
        throw new Error(`Failed to create signature session for ${sessionId}`);
      }
      
      // Queue'ya tracking job ekle
      await this.queueManager.addSignatureTrackingJob(sessionId, Number(event.height));
      
      this.logger.info(`Signature session ${sessionId} created with status ${signatureData.status} and tracking job added`);
    } catch (error) {
      this.logger.error('Error handling signing started event:', error);
      throw error;
    }
  }

  private async createPoll(event: PollStartedEvent): Promise<IAmplifierPoll> {
    const { amplifierPollRepo } = this.db;
    const pollId = event.poll_id.replace(/"/g, '');

    const existingPoll = await amplifierPollRepo.findByPollId(pollId);
    if (existingPoll) {
      this.logger.warn(`Poll ${pollId} already exists, skipping creation`);
      return existingPoll;
    }

    const pollData: IAmplifierPoll = {
      pollId,
      sourceChain: event.source_chain,
      participants: event.participants,
      expiresAt: Number(event.expires_at),
      height: Number(event.height),
      hash: event.hash,
      status: PollStatus.PENDING,
      votes: event.participants.map(participant => ({
        voter: participant,
        vote: 'Unsubmitted' as VoteType
      }))
    };

    return await amplifierPollRepo.create(pollData);
  }

  private async createSignatureSession(event: SigningStartedEvent): Promise<IAmplifierSignature> {
    const { amplifierSignatureRepo } = this.db;
    
    const existingSession = await amplifierSignatureRepo.findBySessionId(event.session_id);
    if (existingSession) {
      this.logger.warn(`Signature session ${event.session_id} already exists, skipping creation`);
      return existingSession;
    }

    const signatureData: IAmplifierSignature = {
      sessionId: event.session_id,
      chain: event.chain,
      contractAddress: event._contract_address,
      pubKeys: Object.entries(event.pub_keys).map(([address, data]) => ({
        address,
        ecdsaKey: data.ecdsa
      })),
      verifierSetId: event.verifier_set_id,
      expiresAt: Number(event.expires_at),
      height: Number(event.height),
      hash: event.hash,
      status: SignatureStatus.PENDING,
      signatures: Object.entries(event.pub_keys).map(([address]) => ({
        verifier: address,
        status: 'Unsubmitted' as SignatureType
      }))
    };

    return await amplifierSignatureRepo.create(signatureData);
  }

  async handlePollCompleted(event: { poll_id: string; status: string }): Promise<void> {
    const status = event.status.includes('not_found_on_source_chain') ? PollStatus.FAILED :
                   event.status.includes('succeeded_on_source_chain') ? PollStatus.COMPLETED : 
                   PollStatus.FAILED;

    try {
      const { amplifierPollRepo } = this.db;
      await amplifierPollRepo.updatePollStatus(event.poll_id, status as PollStatus);
      this.logger.info(`Updated poll ${event.poll_id} status to ${status}`);
    } catch (error) {
      this.logger.error('Error handling poll completed event:', error);
      throw error;
    }
  }

  async handleSigningCompleted(event: { session_id: string }): Promise<void> {
    try {
      const { amplifierSignatureRepo } = this.db;
      await amplifierSignatureRepo.updateStatus(event.session_id, SignatureStatus.COMPLETED);
      this.logger.info(`Updated signature session ${event.session_id} status to ${SignatureStatus.COMPLETED}`);
    } catch (error) {
      this.logger.error('Error handling signing completed event:', error);
      throw error;
    }
  }
}