import { AmplifierVoteChecker } from '@services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '@services/amplifier/AmplifierVerifierService';
import { AmplifierVoteType } from '../../../types/amplifier';
import axios, { AxiosInstance } from 'axios';

describe('AmplifierVoteChecker Integration Test', () => {
  let voteChecker: AmplifierVoteChecker;
  const axiosInstance = axios.create({
    baseURL: 'https://axelar-rpc.qubelabs.io:443' // veya mainnet URL'i
  });

  beforeAll(() => {
    // Gerçek verifier adresi
    process.env.VERIFIER_ADDRESS = 'axelar104jgwmkat4xn2800r6yd44djjhgw2ejrjvqkaj'; // örnek adres
    voteChecker = new AmplifierVoteChecker(axiosInstance);
  });

  it('should check real vote status', async () => {
    // Gerçek bir poll ID
    const pollId = '34'; // test edeceğimiz gerçek poll ID

    const voteStatus = await voteChecker.checkVoteStatus(pollId);
    console.log('Vote Status:', voteStatus);
    
    // Vote tipi kontrolü
    expect([
      AmplifierVoteType.YES,
      AmplifierVoteType.NO,
      AmplifierVoteType.UNSUBMITTED
    ]).toContain(voteStatus);

    // API response detayları
    const response = await axiosInstance.get('/cosmos/tx/v1beta1/txs', {
      params: {
        'events': `wasm-voted.voter='axelar104jgwmkat4xn2800r6yd44djjhgw2ejrjvqkaj'`,
        'pagination.offset': 2,
        'pagination.count_total': true,
        'order_by': 'ORDER_BY_DESC'
      }
    });

    console.log('Transaction Details:', JSON.stringify(response.data, null, 2));
  });

  it('should get real transaction info', async () => {
    const txInfo = await voteChecker.getVoteTxInfo(process.env.VERIFIER_ADDRESS!, '34');
    console.log('Transaction Info:', txInfo);

    if (txInfo) {
      expect(txInfo).toHaveProperty('txHash');
      expect(txInfo).toHaveProperty('txHeight');
    }
  });
});
