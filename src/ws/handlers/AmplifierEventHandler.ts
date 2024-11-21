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
      const session = await this.createSignatureSession(event);
      this.logger.info(`Signature session created/found`, {
        sessionId: session.sessionId,
        chain: session.chain,
        verifierCount: session.pubKeys.length,
        status: session.status
      });
    } catch (error) {
      this.logger.error('Error handling signing started event:', {
        error,
        sessionId: event.session_id,
        chain: event.chain,
        height: event.height
      });
      throw error;
    }
  }

  async handlePollCompleted(event: { poll_id: string; status: string }): Promise<void> {
    const { poll_id, status: eventStatus } = event;
    let status: PollStatus;
    let reason: string;

    if (eventStatus.includes('succeeded_on_source_chain')) {
      status = PollStatus.COMPLETED;
      reason = 'Poll succeeded on source chain';
    } else if (eventStatus.includes('not_found_on_source_chain')) {
      status = PollStatus.FAILED;
      reason = 'Poll not found on source chain';
    } else {
      status = PollStatus.FAILED;
      reason = `Unknown status: ${eventStatus}`;
    }

    try {
      const { amplifierPollRepo } = this.db;
      const poll = await amplifierPollRepo.findByPollId(poll_id);
      
      if (!poll) {
        throw new Error(`Poll ${poll_id} not found`);
      }

      // Even if poll is completed/failed, we should continue tracking votes until expiration
      if (poll.expiresAt > Date.now()) {
        await this.queueManager.addPollTrackingJob(poll_id, poll.height);
        this.logger.info(`Continued vote tracking for poll ${poll_id} until expiration`, {
          currentStatus: status,
          expiresAt: poll.expiresAt,
          reason
        });
      }

      await amplifierPollRepo.updatePollStatus(poll_id, status);
      this.logger.info(`Updated poll ${poll_id} status`, {
        previousStatus: poll.status,
        newStatus: status,
        reason,
        eventStatus,
        expiresAt: poll.expiresAt
      });
    } catch (error) {
      this.logger.error('Error handling poll completed event:', {
        error,
        pollId: poll_id,
        status: eventStatus,
        reason
      });
      throw error;
    }
  }

  async handleSigningCompleted(event: { session_id: string }): Promise<void> {
    const { session_id: sessionId } = event;
    try {
      const { amplifierSignatureRepo } = this.db;
      const session = await amplifierSignatureRepo.findBySessionId(sessionId);

      if (!session) {
        throw new Error(`Signature session ${sessionId} not found`);
      }

      // Even if signing is completed, continue tracking until expiration
      if (session.expiresAt > Date.now()) {
        await this.queueManager.addSignatureTrackingJob(sessionId, session.height);
        this.logger.info(`Continued signature tracking for session ${sessionId} until expiration`, {
          currentStatus: session.status,
          expiresAt: session.expiresAt
        });
      }

      await amplifierSignatureRepo.updateStatus(sessionId, SignatureStatus.COMPLETED);
      this.logger.info(`Updated signature session ${sessionId} status`, {
        previousStatus: session.status,
        newStatus: SignatureStatus.COMPLETED,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      this.logger.error('Error handling signing completed event:', {
        error,
        sessionId
      });
      throw error;
    }
  }

  private async createPoll(event: PollStartedEvent): Promise<IAmplifierPoll> {
    const { amplifierPollRepo } = this.db;
    const pollId = event.poll_id.replace(/"/g, '');

    try {
      const existingPoll = await amplifierPollRepo.findByPollId(pollId);
      if (existingPoll) {
        this.logger.warn(`Poll ${pollId} already exists`, {
          existingStatus: existingPoll.status,
          existingHeight: existingPoll.height,
          newHeight: event.height
        });
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
          vote: 'Unsubmitted' as VoteType,
          lastChecked: Date.now()
        }))
      };

      const createdPoll = await amplifierPollRepo.create(pollData);
      
      // Start tracking immediately
      await this.queueManager.addPollTrackingJob(pollId, Number(event.height));
      
      this.logger.info(`Created new poll ${pollId}`, {
        sourceChain: event.source_chain,
        participantCount: event.participants.length,
        expiresAt: event.expires_at,
        height: event.height
      });

      return createdPoll;
    } catch (error) {
      this.logger.error(`Failed to create poll ${pollId}:`, {
        error,
        sourceChain: event.source_chain,
        height: event.height,
        participants: event.participants.length
      });
      throw error;
    }
  }

  private async createSignatureSession(event: SigningStartedEvent): Promise<IAmplifierSignature> {
    const { amplifierSignatureRepo } = this.db;
    const sessionId = event.session_id;
    
    try {
      const existingSession = await amplifierSignatureRepo.findBySessionId(sessionId);
      if (existingSession) {
        this.logger.warn(`Signature session ${sessionId} already exists`, {
          existingStatus: existingSession.status,
          existingHeight: existingSession.height,
          newHeight: event.height
        });
        return existingSession;
      }

      const signatureData: IAmplifierSignature = {
        sessionId,
        chain: event.chain,
        contractAddress: event._contract_address,
        pubKeys: Object.entries(event.pub_keys).map(([address, data]) => ({
          address,
          ecdsaKey: data.ecdsa,
          lastChecked: Date.now()
        })),
        verifierSetId: event.verifier_set_id,
        expiresAt: Number(event.expires_at),
        height: Number(event.height),
        hash: event.hash,
        status: SignatureStatus.PENDING,
        signatures: Object.entries(event.pub_keys).map(([address]) => ({
          verifier: address,
          status: 'Unsubmitted' as SignatureType,
          lastChecked: Date.now()
        }))
      };

      const createdSession = await amplifierSignatureRepo.create(signatureData);
      
      // Start tracking immediately
      await this.queueManager.addSignatureTrackingJob(sessionId, Number(event.height));
      
      this.logger.info(`Created new signature session ${sessionId}`, {
        chain: event.chain,
        verifierCount: Object.keys(event.pub_keys).length,
        expiresAt: event.expires_at,
        height: event.height
      });

      return createdSession;
    } catch (error) {
      this.logger.error(`Failed to create signature session ${sessionId}:`, {
        error,
        chain: event.chain,
        height: event.height,
        verifierCount: Object.keys(event.pub_keys).length
      });
      throw error;
    }
  }

  private isExpired(expiresAt: number): boolean {
    return expiresAt <= Date.now();
  }

  private shouldContinueTracking(expiresAt: number, status: PollStatus | SignatureStatus): boolean {
    return !this.isExpired(expiresAt) && 
           status !== PollStatus.FAILED && 
           status !== SignatureStatus.FAILED;
  }

  private async updateTrackingTimestamps(pollId: string): Promise<void> {
    try {
      const { amplifierPollRepo } = this.db;
      const poll = await amplifierPollRepo.findByPollId(pollId);
      
      if (!poll) return;

      const now = Date.now();
      const updatedVotes = poll.votes.map(vote => ({
        ...vote,
        lastChecked: now
      }));

      await amplifierPollRepo.updateVoteStatus(pollId, updatedVotes, );
    } catch (error) {
      this.logger.error('Error updating tracking timestamps:', {
        error,
        pollId
      });
    }
  }
}