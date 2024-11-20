import { AppDb } from "@/database/database";
import { AmplifierQueryService } from "@/services/rest/AmplifierQueryService";
import { logger } from "@/utils/logger";
import { Job } from "bull";
import { SignatureStatus, SignatureType } from "@/database/models/amplifier/signature.interface";
import { Logger } from "winston";
interface SignatureTrackingData {
  sessionId: string;
  currentHeight: number;
}

export class SignatureTrackingJob {
  private readonly logger: Logger;

  constructor(
    private readonly db: AppDb,
    private readonly queryService: AmplifierQueryService
  ) {
    this.logger = logger.child({
      name: SignatureTrackingJob.name
    });
  }

  async process(job: Job<SignatureTrackingData>): Promise<void> {
    const { sessionId, currentHeight } = job.data;
    const { amplifierSignatureRepo } = this.db;

    try {
      const session = await amplifierSignatureRepo.findBySessionId(sessionId);
      if (!session) {
        this.logger.warn(`Signature session ${sessionId} not found`);
        return;
      }

      // Check if session has expired
      if (currentHeight >= session.expiresAt) {
        if (session.status === SignatureStatus.PENDING) {
          await amplifierSignatureRepo.updateStatus(sessionId, SignatureStatus.FAILED);
          this.logger.info(`Session ${sessionId} marked as Failed due to expiration`);
        }
        return;
      }

      // Update signature statuses
      for (const sig of session.signatures) {
        const currentStatus = await this.queryService.getSignatureStatus(sig.verifier, sessionId);
        if (currentStatus !== sig.status) {
          await amplifierSignatureRepo.updateSignatureStatus(sessionId, sig.verifier, currentStatus as SignatureType);
          this.logger.info(`Updated signature status for ${sig.verifier} in session ${sessionId} to ${currentStatus}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing signature tracking for ${sessionId}:`, error);
      throw error;
    }
  }
}