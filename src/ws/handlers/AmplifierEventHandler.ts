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
import { WsMessageTxResult } from "@/ws/message/WsMessageTxResult";

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
  private queueManager: AmplifierQueueManager | null = null;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService,
    queueManager?: AmplifierQueueManager
  ) {
    this.logger = logger.child({ name: AmplifierEventHandler.name });
    this.queueManager = queueManager || null; // Initialize as null
  }

  private async getQueueManager(): Promise<AmplifierQueueManager> {
    if (!this.queueManager) {
      this.queueManager = await AmplifierQueueManager.getInstance();
    }
    return this.queueManager;
  }

  async handlePollStarted(event: unknown): Promise<void> {
    if (!isPollStartedEvent(event)) {
      this.logger.error('Invalid poll started event format');
      throw new Error('Invalid event format');
    }

    try {
      const pollId = event.poll_id.replace(/"/g, '');
      const pollData = await this.createPoll(event);
      
      if (!pollData) {
        throw new Error(`Failed to create poll for ${pollId}`);
      }

      const queueManager = await this.getQueueManager();
      // Start tracking only if poll is in valid state
      if (await this.shouldContinueTracking(pollData.expiresAt, pollData.status)) {
        await queueManager.addPollTrackingJob(pollId, Number(event.height));
        await this.updateTrackingTimestamps(pollId);
        
        this.logger.info(`Started tracking for poll ${pollId}`, {
          status: pollData.status,
          expiresAt: pollData.expiresAt,
          height: event.height
        });
      } else {
        this.logger.info(`Not tracking poll ${pollId}`, {
          expired: await this.isExpired(pollData.expiresAt),
          status: pollData.status,
          expiresAt: pollData.expiresAt
        });
      }
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
      const queueManager = await this.getQueueManager();
      
      // Start tracking only if session is in valid state
      if (await this.shouldContinueTracking(session.expiresAt, session.status)) {
        await queueManager.addSignatureTrackingJob(session.sessionId, Number(event.height));
        await this.updateSignatureTrackingTimestamps(session.sessionId);
        
        this.logger.info(`Started tracking for signature session ${session.sessionId}`, {
          status: session.status,
          expiresAt: session.expiresAt,
          height: event.height
        });
      } else {
        this.logger.info(`Not tracking signature session ${session.sessionId}`, {
          expired: await this.isExpired(session.expiresAt),
          status: session.status,
          expiresAt: session.expiresAt
        });
      }

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

  async handlePollCompleted(event: { poll_id: string; status: string; hash: string }): Promise<void> {
    const { poll_id, status: eventStatus, hash } = event;
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
      
      // Add retry logic for poll lookup
      let poll = null;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      while (!poll && retryCount < maxRetries) {
        poll = await amplifierPollRepo.findByPollId(poll_id);
        if (!poll) {
          this.logger.info(`Poll ${poll_id} not found, retry ${retryCount + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryCount++;
        }
      }
      
      if (!poll) {
        // If poll is still not found after retries, create it
        this.logger.info(`Creating poll ${poll_id} from completion event`);
        const currentHeight = await this.queryService.getCurrentBlockHeight();
        poll = await amplifierPollRepo.create({
          pollId: poll_id,
          sourceChain: 'unknown', // We don't have this info from the completion event
          participants: [], // Will be populated by tracking job
          expiresAt: currentHeight + 100, // Default expiration window
          height: currentHeight,
          hash,
          status: PollStatus.PENDING,
          votes: []
        });
      }

      // Update status first
      await amplifierPollRepo.updatePollStatus(poll_id, status);
      this.logger.info(`Updated poll ${poll_id} status`, {
        previousStatus: poll.status,
        newStatus: status,
        reason,
        eventStatus,
        expiresAt: poll.expiresAt
      });

      const queueManager = await this.getQueueManager();
      // Use shouldContinueTracking to determine if we should keep monitoring
      if (await this.shouldContinueTracking(poll.expiresAt, status)) {
        await queueManager.addPollTrackingJob(poll_id, poll.height);
        await this.updateTrackingTimestamps(poll_id);
        
        this.logger.info(`Continued vote tracking for poll ${poll_id} until expiration`, {
          currentStatus: status,
          expiresAt: poll.expiresAt,
          reason
        });
      } else {
        this.logger.info(`Not continuing vote tracking for poll ${poll_id}`, {
          expired: await this.isExpired(poll.expiresAt),
          status,
          expiresAt: poll.expiresAt,
          reason
        });
      }
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

      const queueManager = await this.getQueueManager();
      // Use shouldContinueTracking to determine if we should keep monitoring
      if (await this.shouldContinueTracking(session.expiresAt, session.status)) {
        await queueManager.addSignatureTrackingJob(sessionId, session.height);
        await this.updateSignatureTrackingTimestamps(sessionId);
        
        this.logger.info(`Continued signature tracking for session ${sessionId} until expiration`, {
          currentStatus: session.status,
          expiresAt: session.expiresAt
        });
      } else {
        this.logger.info(`Not continuing signature tracking for session ${sessionId}`, {
          expired: await this.isExpired(session.expiresAt),
          status: session.status,
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

  async handleMessageResult(result: WsMessageTxResult): Promise<void> {
    try {
      const events = result.events || {};
      const height = result.getTxHeight();
      const hash = result.getTxHash() || '';
      const currentHeight = await this.queryService.getCurrentBlockHeight();
      
      // Debug log all events
      this.logger.debug('Received amplifier message events:', {
        eventKeys: Object.keys(events),
        events: events,
        height,
        hash
      });
      
      // Handle signing started event
      if (events['wasm-signing_started.session_id']) {
        const event: SigningStartedEvent = {
          chain: events['wasm-signing_started.chain']?.[0] || '',
          session_id: events['wasm-signing_started.session_id']?.[0] || '',
          _contract_address: events['wasm-signing_started._contract_address']?.[0] || '',
          pub_keys: JSON.parse(events['wasm-signing_started.pub_keys']?.[0] || '{}'),
          verifier_set_id: events['wasm-signing_started.verifier_set_id']?.[0] || '',
          expires_at: Number(events['wasm-signing_started.expires_at']?.[0] || '0'),
          height: height || 0,
          hash
        };
        
        if (isSigningStartedEvent(event)) {
          this.logger.debug('Received signing started event', {
            sessionId: event.session_id,
            expiresAt: event.expires_at,
          });
          await this.handleSigningStarted(event);
        } else {
          this.logger.warn('Invalid signing started event format', { event });
        }
      }
      
      // Handle poll started event
      if (events['wasm-messages_poll_started.poll_id']) {
        const event: PollStartedEvent = {
          source_chain: events['wasm-messages_poll_started.source_chain']?.[0] || '',
          poll_id: events['wasm-messages_poll_started.poll_id']?.[0].replace(/"/g, '') || '',
          participants: JSON.parse(events['wasm-messages_poll_started.participants']?.[0] || '[]'),
          expires_at: Number(events['wasm-messages_poll_started.expires_at']?.[0] || '0'),
          height: height || 0,
          hash
        };
        
        if (isPollStartedEvent(event)) {
          this.logger.debug('Received poll started event', {
            pollId: event.poll_id,
            expiresAt: event.expires_at,
            currentHeight
          });
          await this.handlePollStarted(event);
        } else {
          this.logger.warn('Invalid poll started event format', { event });
        }
      }
      
      // Handle poll completed event
      if (events['wasm-quorum_reached.poll_id']) {
        this.logger.debug('Found quorum_reached event', {
          pollId: events['wasm-quorum_reached.poll_id']?.[0],
          status: events['wasm-quorum_reached.status']?.[0],
          allEvents: events,
          txHash: hash
        });
        
        const event = {
          poll_id: events['wasm-quorum_reached.poll_id']?.[0].replace(/"/g, '') || '',
          status: events['wasm-quorum_reached.status']?.[0].replace(/"/g, '') || '',
          hash // Pass the transaction hash to handlePollCompleted
        };
        
        if (event.poll_id) {
          await this.handlePollCompleted(event);
        } else {
          this.logger.warn('Invalid poll completed event format', { event });
        }
      } else {
        // Debug log when we don't find the quorum event
        if (events['wasm-messages_poll_started.poll_id']) {
          this.logger.debug('Poll event received but no quorum_reached event', {
            pollId: events['wasm-messages_poll_started.poll_id']?.[0],
            eventKeys: Object.keys(events)
          });
        }
      }
      
      // Handle signing completed event
      if (events['wasm-signing_completed.session_id']) {
        const event = {
          session_id: events['wasm-signing_completed.session_id']?.[0] || '',
          status: events['wasm-signing_completed.status']?.[0] || ''
        };
        
        if (event.session_id) {
          await this.handleSigningCompleted(event);
        } else {
          this.logger.warn('Invalid signing completed event format', { event });
        }
      }
    } catch (error) {
      this.logger.error('Error handling amplifier message:', error);
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
          vote: VoteType.UNSUBMITTED,
          lastChecked: Date.now()
        }))
      };

      const createdPoll = await amplifierPollRepo.create(pollData);
      
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
          status: SignatureType.UNSUBMITTED,
          lastChecked: Date.now()
        }))
      };

      const createdSession = await amplifierSignatureRepo.create(signatureData);
      
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

  private async isExpired(expiresAt: number): Promise<boolean> {
    try {
      const currentHeight = await this.queryService.getCurrentBlockHeight();
      const isExpired = currentHeight >= expiresAt;
      
      this.logger.debug(`Checking block height expiration`, {
        currentHeight,
        expiresAt,
        isExpired
      });
      
      return isExpired;
    } catch (error) {
      this.logger.error('Error checking block height expiration:', error);
      // If we can't get the current height, assume not expired to be safe
      return false;
    }
  }

  private async shouldContinueTracking(expiresAt: number, status: PollStatus | SignatureStatus): Promise<boolean> {
    const isExpired = await this.isExpired(expiresAt);
    const shouldTrack = !isExpired && 
           status !== PollStatus.FAILED && 
           status !== SignatureStatus.FAILED;
    
    this.logger.debug(`Checking if should continue tracking`, {
      expiresAt,
      status,
      shouldTrack,
      isExpired
    });
    
    return shouldTrack;
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

      await amplifierPollRepo.updateStatus(pollId, updatedVotes);
    } catch (error) {
      this.logger.error('Error updating tracking timestamps:', {
        error,
        pollId
      });
    }
  }

  private async updateSignatureTrackingTimestamps(sessionId: string): Promise<void> {
    try {
      const { amplifierSignatureRepo } = this.db;
      const session = await amplifierSignatureRepo.findBySessionId(sessionId);
      
      if (!session) {
        this.logger.warn(`Signature session ${sessionId} not found for timestamp update`);
        return;
      }

      const now = Date.now();
      const updatedSignatures = session.signatures.map(sig => ({
        ...sig,
        lastChecked: now
      }));

      await amplifierSignatureRepo.updateSignatures(sessionId, updatedSignatures);

      this.logger.debug(`Updated signature tracking timestamps for session ${sessionId}`, {
        verifierCount: session.signatures.length,
        timestamp: now
      });
    } catch (error) {
      this.logger.error('Error updating signature tracking timestamps:', {
        error,
        sessionId
      });
    }
  }
}