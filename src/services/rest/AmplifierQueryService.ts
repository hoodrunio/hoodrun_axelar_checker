import { AxiosInstance } from 'axios';
import { VoteResponse } from '@database/models/amplifier/poll.interface';
import { SignatureResponse } from '@database/models/amplifier/signature.interface';
import { SignatureType } from '@database/models/amplifier/signature.interface';
import { VoteType } from '@database/models/amplifier/poll.interface';
export class AmplifierQueryService {
  constructor(
    private readonly axiosClient: AxiosInstance,
    private readonly baseUrl: string
  ) {
    console.log('Service initialized with base URL:', baseUrl);
  }

  async getVoteStatus(voterAddress: string, pollId: string): Promise<VoteType> {
    try {
      const url = `${this.baseUrl}/cosmos/tx/v1beta1/txs`;
      
      let offset = 0;
      const limit = 100;
      let status: VoteType = VoteType.UNSUBMITTED;
      let total = 0;

      do {
        const response = await this.axiosClient.get<VoteResponse>(url, {
          params: {
            'events': `wasm-voted.voter='${voterAddress}'`,
            'pagination.offset': offset,
            'pagination.limit': limit,
            'pagination.count_total': true,
            'order_by': 'ORDER_BY_DESC'
          }
        });

        // console.log('Response received:', response.data);

        if (offset === 0) {
          total = parseInt(response.data.pagination.total || '0');
        }

        // Find vote for specific poll_id
        const voteTx = response.data.tx_responses.find(tx => {
          const msg = tx.tx.body.messages[0].msg;
          return msg?.vote?.poll_id === pollId && tx.tx.body.messages[0].sender === voterAddress;
        });

        if (voteTx) {
          const votes = voteTx.tx.body.messages[0].msg?.vote?.votes || [];
          status = votes.includes('succeeded_on_chain') ? VoteType.YES : VoteType.NO;
          break;
        }

        offset += limit;

      } while (offset < total);

      return status;

    } catch (error) {
      console.error(`Error fetching vote status for voter ${voterAddress} and poll ${pollId}:`, error);
      throw error;
    }
  }

  async getSignatureStatus(verifierAddress: string, sessionId: string): Promise<SignatureType> {
    try {
      const url = `${this.baseUrl}/cosmos/tx/v1beta1/txs`;
      
      let offset = 0;
      const limit = 100;
      let total = 0;

      do {
        const response = await this.axiosClient.get<SignatureResponse>(url, {
          params: {
            'events': `wasm-signature_submitted.session_id='${sessionId}'`,
            'pagination.offset': offset,
            'pagination.limit': limit,
            'pagination.count_total': true,
            'order_by': 'ORDER_BY_DESC'
          }
        });

        if (offset === 0) {
          total = parseInt(response.data.pagination.total || '0');
        }

        // Find signature for specific session_id
        const signatureTx = response.data.tx_responses.find(tx => {
          const msg = tx.tx.body.messages[0].msg;
          return msg?.submit_signature?.session_id === sessionId && 
                 tx.tx.body.messages[0].sender === verifierAddress;
        });

        if (signatureTx) {
          const hasSignature = signatureTx.tx.body.messages[0].msg?.submit_signature?.signature;
          return hasSignature ? SignatureType.YES : SignatureType.INVALID;
        }

        offset += limit;

      } while (offset < total);

      return SignatureType.UNSUBMITTED;

    } catch (error) {
      console.error(`Error fetching signature status for verifier ${verifierAddress} and session ${sessionId}:`, error);
      throw error;
    }
  }
}