import { AmplifierQueryService } from '@services/rest/AmplifierQueryService';
import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('AmplifierQueryService', () => {
  let service: AmplifierQueryService;
  let axiosClient: AxiosInstance;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    axiosClient = axios.create();
    mockAxios = new MockAdapter(axiosClient);
    service = new AmplifierQueryService(axiosClient, 'https://axelar-lcd.quickapi.com');
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('getVoteStatus', () => {
    const voterAddress = 'axelar1zqnwrhv35cyf65u0059a8rvw8njtqeqjckzhlx';
    const pollId = '43';

    it('should return Yes when vote exists with succeeded_on_chain', async () => {
      const result = await service.getVoteStatus(voterAddress, pollId);
      expect(result).toBe('Yes');
    });

    it('should return No when vote exists without succeeded_on_chain', async () => {
      const result = await service.getVoteStatus(voterAddress, pollId);
      expect(result).toBe('No');
    });

    it('should return Unsubmitted when no vote found', async () => {
      const result = await service.getVoteStatus(voterAddress, pollId);
      expect(result).toBe('Unsubmitted');
    });
  });

  describe('getSignatureStatus', () => {
    const verifierAddress = 'axelar104jgwmkat4xn2800r6yd44djjhgw2ejrjvqkaj';
    const sessionId = '20';

    it('should return Yes when signature exists', async () => {
      const result = await service.getSignatureStatus(verifierAddress, sessionId);
      expect(result).toBe('Yes');
    });

    it('should return Unsubmitted when no signature found', async () => {
      const result = await service.getSignatureStatus(verifierAddress, sessionId);
      expect(result).toBe('Unsubmitted');
    });

    it('should return Invalid when transaction exists without signature', async () => {
      const result = await service.getSignatureStatus(verifierAddress, sessionId);
      expect(result).toBe('Invalid');
    });
  });
}); 