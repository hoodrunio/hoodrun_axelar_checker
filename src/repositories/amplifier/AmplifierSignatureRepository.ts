import BaseRepository from '@repositories/base.repository';
import { IAmplifierSignature, IAmplifierSignatureDocument } from '@database/models/amplifier/signature.interface';
import AmplifierSignatureDbModel from '@database/models/amplifier/signature.model';

export class AmplifierSignatureRepository extends BaseRepository<IAmplifierSignature, IAmplifierSignatureDocument> {
  constructor() {
    super(AmplifierSignatureDbModel);
  }

  async findBySessionId(sessionId: string): Promise<IAmplifierSignatureDocument | null> {
    return this.findOne({ sessionId });
  }

  async updateSignatureStatus(
    sessionId: string, 
    verifier: string, 
    status: 'Yes' | 'Unsubmitted' | 'Invalid'
  ): Promise<void> {
    const signature = await this.findBySessionId(sessionId);
    if (!signature) return;

    const sigIndex = signature.signatures.findIndex(s => s.verifier === verifier);
    if (sigIndex === -1) {
      signature.signatures.push({ verifier, status, submittedAt: Date.now() });
    } else {
      signature.signatures[sigIndex] = { 
        ...signature.signatures[sigIndex], 
        status, 
        submittedAt: Date.now() 
      };
    }

    await this.updateOne({ sessionId }, { signatures: signature.signatures });
  }

  async updateSessionStatus(
    sessionId: string, 
    status: 'Pending' | 'Completed' | 'Failed'
  ): Promise<void> {
    await this.updateOne({ sessionId }, { status });
  }
} 