import { AmplifierVoteChecker } from '@/services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '@/services/amplifier/AmplifierVerifierService';
import { AmplifierVoteType } from '@/types/amplifier';
import { AppDb } from '@/database/database';
import axios, { AxiosDefaults, AxiosHeaderValue, AxiosInstance, HeadersDefaults } from 'axios';

jest.mock('@/services/amplifier/AmplifierVerifierService');
jest.mock('axios');
jest.mock('@/database/database');

describe('AmplifierVoteChecker', () => {
  let voteChecker: AmplifierVoteChecker;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  let mockVerifierService: jest.Mocked<AmplifierVerifierService>;

  beforeEach(() => {
    // Mock AxiosInstance
    mockAxiosInstance = {
      get: jest.fn(),
      getUri: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      patchForm: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
      defaults: {
        headers: {} as HeadersDefaults & { [key: string]: AxiosHeaderValue },
        // add other properties as needed
      } as Omit<AxiosDefaults<any>, "headers"> & { headers: HeadersDefaults & { [key: string]: AxiosHeaderValue } },
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() }
      }
    } as unknown as jest.Mocked<AxiosInstance>;

    // Mock VerifierService
    const MockVerifierService = jest.fn(() => ({
      isConfigured: jest.fn().mockReturnValue(true),
      getVerifierAddress: jest.fn().mockReturnValue('verifier_address')
    }));

    mockVerifierService = new MockVerifierService() as unknown as jest.Mocked<AmplifierVerifierService>;
    (AmplifierVerifierService.getInstance as jest.Mock).mockReturnValue(mockVerifierService);
    
    voteChecker = new AmplifierVoteChecker(mockAxiosInstance);
  });

  describe('checkVoteStatus', () => {
    it('should return UNSUBMITTED when no transactions found', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { txs: [] } });

      const result = await voteChecker.checkVoteStatus('test_poll_id');
      
      expect(result).toBe(AmplifierVoteType.UNSUBMITTED);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/cosmos/tx/v1beta1/txs'),
        expect.any(Object)
      );
    });

    it('should return YES for succeeded_on_chain vote', async () => {
      const mockTxResponse = {
        data: {
          txs: [{
            body: {
              messages: [{
                '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
                msg: {
                  vote: {
                    poll_id: 'test_poll_id',
                    votes: ['succeeded_on_chain']
                  }
                }
              }]
            }
          }]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockTxResponse);

      const result = await voteChecker.checkVoteStatus('test_poll_id');
      
      expect(result).toBe(AmplifierVoteType.YES);
      console.log(mockAxiosInstance.get.mock.calls);
    });

    it('should return NO for non-succeeded vote', async () => {
      const mockTxResponse = {
        data: {
          txs: [{
            body: {
              messages: [{
                '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
                msg: {
                  vote: {
                    poll_id: 'test_poll_id',
                    votes: ['failed_on_chain']
                  }
                }
              }]
            }
          }]
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockTxResponse);

      const result = await voteChecker.checkVoteStatus('test_poll_id');
      
      expect(result).toBe(AmplifierVoteType.NO);
      console.log(mockAxiosInstance.get.mock.calls);
    });
  });
});
