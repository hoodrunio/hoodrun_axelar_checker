import { AMPLIFIER_CONFIG } from '@/config/amplifier.config';
import { logger } from '@/utils/logger';

export class AmplifierVerifierService {
  private static instance: AmplifierVerifierService;
  private verifierAddress: string | undefined;

  private constructor() {
    this.verifierAddress = AMPLIFIER_CONFIG.VERIFIER_ADDRESS;
  }

  public static getInstance(): AmplifierVerifierService {
    if (!AmplifierVerifierService.instance) {
      AmplifierVerifierService.instance = new AmplifierVerifierService();
    }
    return AmplifierVerifierService.instance;
  }

  public getVerifierAddress(): string {
    if (!this.verifierAddress) {
      throw new Error('VERIFIER_ADDRESS is not configured');
    }
    return this.verifierAddress;
  }

  public isConfigured(): boolean {
    return !!this.verifierAddress;
  }
}
