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
    const decoded: Partial<IDecodedSigningAttributes> = {
      pubKeys: {}
    };

    attributes.forEach(attr => {
      const key = this.decodeBase64(attr.key);
      const value = this.decodeBase64(attr.value);

      switch(key) {
        case 'session_id':
          decoded.sessionId = value;
          break;
        case 'chain':
          decoded.chain = value;
          break;
        case '_contract_address':
          decoded.contractAddress = value;
          break;
        case 'verifier_set_id':
          decoded.verifierSetId = value;
          break;
        case 'pub_keys':
          const pubKeysObj = JSON.parse(value);
          Object.entries(pubKeysObj).forEach(([address, keys]) => {
            decoded.pubKeys![address] = {
              ecdsa: (keys as any).ecdsa
            };
          });
          break;
      }
    });

    if (!this.validateSigningAttributes(decoded)) {
      throw new Error('Missing required attributes in signing event');
    }

    return decoded as IDecodedSigningAttributes;
  }

  private validateSigningAttributes(decoded: Partial<IDecodedSigningAttributes>): boolean {
    return !!(
      decoded.sessionId &&
      decoded.chain &&
      decoded.contractAddress &&
      decoded.verifierSetId &&
      decoded.pubKeys
    );
  }
}