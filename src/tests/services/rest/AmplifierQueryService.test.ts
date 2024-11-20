import { AmplifierQueryService } from '@services/rest/AmplifierQueryService';
import axios from 'axios';

describe('AmplifierQueryService', () => {
  let service: AmplifierQueryService;

  beforeEach(() => {
    const axiosClient = axios.create();
    service = new AmplifierQueryService(axiosClient, 'https://lcd-axelar.hoodrun.io');
  });

  describe('getVoteStatus', () => {
    const voterAddress = 'axelar1kaeq00sgqvy65sngedc8dqwxerqzsg2xf7e72z';
    const pollId = '56';

    it('should check vote status for a specific poll', async () => {
      console.log(`Checking vote status for voter: ${voterAddress}, poll: ${pollId}`);
      
      const result = await service.getVoteStatus(voterAddress, pollId);
      
      console.log('Vote Status Result:', {
        voterAddress,
        pollId,
        status: result
      });

      // Sadece sonucun geçerli bir değer olduğunu kontrol ediyoruz
      expect(['Yes', 'No', 'Unsubmitted']).toContain(result);
    });
  });

  describe('getSignatureStatus', () => {
    const verifierAddress = 'axelar1x0a0ylzsjrr57v2ymnsl0d770nt3pwktet9npg';
    const sessionId = '31';

    it('should check signature status for a specific session', async () => {
      console.log(`Checking signature status for verifier: ${verifierAddress}, session: ${sessionId}`);
      
      const result = await service.getSignatureStatus(verifierAddress, sessionId);
      
      console.log('Signature Status Result:', {
        verifierAddress,
        sessionId,
        status: result
      });

      // Sadece sonucun geçerli bir değer olduğunu kontrol ediyoruz
      expect(['Yes', 'Unsubmitted', 'Invalid']).toContain(result);
    });
  });
}); 