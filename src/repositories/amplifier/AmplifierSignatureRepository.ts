import BaseRepository from '@/repositories/base.repository';
import { IAmplifierSignature, IAmplifierSignatureDocument, SignatureStatus, SignatureType, SignatureInfo } from '@/database/models/amplifier/signature.interface';
import AmplifierSignatureDbModel from '@/database/models/amplifier/signature.model';

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
    status: SignatureType
  ): Promise<void> {
    const signature = await this.findBySessionId(sessionId);
    if (!signature) return;

    const sigIndex = signature.signatures.findIndex(s => s.verifier === verifier);
    if (sigIndex === -1) {
      signature.signatures.push({ verifier, status: status as SignatureType, submittedAt: Date.now() });
    } else {
      signature.signatures[sigIndex] = { 
        verifier,  
        status: status as SignatureType, 
        submittedAt: Date.now() 
      };
    }

    await this.updateOne({ sessionId }, { signatures: signature.signatures });
  }

  async updateStatus(
    sessionId: string,
    status: SignatureStatus
  ): Promise<void> {
    if (!Object.values(SignatureStatus).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    
    await this.updateOne({ sessionId }, { status });
  }

  async updateSignatures(
    sessionId: string,
    signatures: SignatureInfo[]
  ): Promise<void> {
    await this.updateOne(
      { sessionId },
      { signatures }
    );
  }

  async updateSignatureLastChecked(
    sessionId: string,
    verifier: string,
    lastChecked: number
  ): Promise<void> {
    await this.getModel().updateOne(
      { sessionId, "signatures.verifier": verifier },
      { $set: { "signatures.$.lastChecked": lastChecked } }
    );
  }

  async count(filter: Record<string, any> = {}): Promise<number> {
    return await this.getModel().countDocuments(filter).exec();
  }
} 