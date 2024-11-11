import { IDecodedPollAttributes, IDecodedSigningAttributes } from '@/types/amplifier';
import { IAmplifierPollAttributes } from '@/types/amplifier/index';

export class AmplifierEventDecoder {
  private decodeBase64(value: string): string {
    return Buffer.from(value, 'base64').toString();
  }

  public decodePollAttributes(attributes: Array<{ key: string; value: string }>): IAmplifierPollAttributes {
    const decoded: Partial<IAmplifierPollAttributes> = {};
    
    attributes.forEach(attr => {
      const key = this.decodeBase64(attr.key);
      const value = this.decodeBase64(attr.value);

      switch(key) {
        case 'poll_id':
          decoded.pollId = JSON.parse(value);
          break;
        case 'source_chain':
          decoded.sourceChain = value;
          break;
        case 'participants':
          decoded.participants = JSON.parse(value);
          break;
        case 'confirmation_height':
          decoded.confirmationHeight = parseInt(value);
          break;
        case 'expires_at':
          decoded.expiresAt = parseInt(value);
          break;
        case 'messages':
          decoded.messages = JSON.parse(value);
          break;
        case '_contract_address':
          decoded.contractAddress = value;
          break;
        case 'source_gateway_address':
          decoded.sourceGatewayAddress = value;
          break;
      }
    });

    if (!this.validateDecodedAttributes(decoded)) {
      throw new Error('Missing required attributes in poll event');
    }

    return decoded as IAmplifierPollAttributes;
  }

  private validateDecodedAttributes(decoded: Partial<IAmplifierPollAttributes>): boolean {
    return !!(
      decoded.pollId &&
      decoded.sourceChain &&
      decoded.participants &&
      decoded.confirmationHeight &&
      decoded.expiresAt
    );
  }

  public decodeSigningAttributes(attributes: Array<{ key: string; value: string }>): IDecodedSigningAttributes {
    // Benzer decoder mantığı
    return {} as IDecodedSigningAttributes;
  }
} 