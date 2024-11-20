import { AppDb } from "@/database/database";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import { 
  IAmplifierPoll, 
  PollStartedEvent,
  PollStatus 
} from "@/database/models/amplifier/poll.interface";
import { 
  IAmplifierSignature, 
  SigningStartedEvent,
  SignatureStatus
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

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.logger = logger;
  }

  async handlePollStarted(event: unknown): Promise<void> {
    if (!isPollStartedEvent(event)) {
      this.logger.error('Invalid poll started event format');
      throw new Error('Invalid event format');
    }

    try {
      const { amplifierPollRepo } = this.db;

      const existingPoll = await amplifierPollRepo.findByPollId(event.poll_id);
      if (existingPoll) {
        this.logger.warn(`Poll ${event.poll_id} already exists, skipping`);
        return;
      }

      const pollId = event.poll_id.replace(/"/g, '');
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
          vote: 'Unsubmitted'
        }))
      };

      await amplifierPollRepo.create(pollData);
      this.logger.info(`Created new poll ${event.poll_id}`);

      for (const participant of event.participants) {
        const voteStatus = await this.queryService.getVoteStatus(participant, event.poll_id);
        if (voteStatus !== 'Unsubmitted') {
          await amplifierPollRepo.updateVoteStatus(event.poll_id, participant, voteStatus);
        }
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
      const { amplifierSignatureRepo } = this.db;

      const existingSession = await amplifierSignatureRepo.findBySessionId(event.session_id);
      if (existingSession) {
        this.logger.warn(`Signature session ${event.session_id} already exists, skipping`);
        return;
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
          status: 'Unsubmitted'
        }))
      };

      await amplifierSignatureRepo.create(signatureData);
      this.logger.info(`Created new signature session ${event.session_id}`);

      for (const [address] of Object.entries(event.pub_keys)) {
        const sigStatus = await this.queryService.getSignatureStatus(address, event.session_id);
        if (sigStatus !== 'Unsubmitted') {
          await amplifierSignatureRepo.updateSignatureStatus(event.session_id, address, sigStatus);
        }
      }
    } catch (error) {
      this.logger.error('Error handling signing started event:', error);
      throw error;
    }
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