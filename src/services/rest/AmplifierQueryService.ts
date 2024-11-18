import { AxiosInstance } from 'axios';

interface VoteResponse {
  tx_responses: Array<{
    raw_log: string;
    tx: {
      body: {
        messages: Array<{
          messages?: Array<{
            msg?: {
              vote?: {
                poll_id: string;
                votes: string[];
              };
            };
          }>;
        }>;
      };
    };
  }>;
  pagination: {
    next_key: string | null;
    total: string;
  };
}

interface SignatureResponse {
  tx_responses: Array<{
    raw_log: string;
    tx: {
      body: {
        messages: Array<{
          msg?: {
            submit_signature?: {
              session_id: string;
              signature: string;
            };
          };
        }>;
      };
    };
  }>;
  pagination: {
    next_key: string | null;
    total: string;
  };
}

export class AmplifierQueryService {
  constructor(
    private readonly axiosClient: AxiosInstance,
    private readonly baseUrl: string
  ) {}

  async getVoteStatus(voterAddress: string, pollId: string): Promise<'Yes' | 'No' | 'Unsubmitted'> {
    try {
      let hasMorePages = true;
      let offset = 0;
      const limit = 10; // Adjust based on API limits

      while (hasMorePages) {
        const response = await this.axiosClient.get<VoteResponse>(
          `${this.baseUrl}/cosmos/tx/v1beta1/txs`,
          {
            params: {
              'events': `wasm-voted.voter='${voterAddress}'`,
              'pagination.offset': offset,
              'pagination.limit': limit,
              'order_by': 'ORDER_BY_DESC'
            }
          }
        );

        // Find vote for specific poll_id
        const voteTx = response.data.tx_responses.find(tx => {
          const messages = tx.tx.body.messages[0].messages;
          if (!messages) return false;
          
          return messages.some(msg => msg.msg?.vote?.poll_id === pollId);
        });

        if (voteTx) {
          // Found the vote for this poll
          const voteMsg = voteTx.tx.body.messages[0].messages?.find(
            msg => msg.msg?.vote?.poll_id === pollId
          );
          
          return voteMsg?.msg?.vote?.votes.includes('succeeded_on_chain') ? 'Yes' : 'No';
        }

        // Check if there are more pages
        hasMorePages = !!response.data.pagination.next_key;
        offset += limit;

        // If total transactions is less than current offset, no need to continue
        const total = parseInt(response.data.pagination.total || '0');
        if (total <= offset) {
          break;
        }
      }

      // If we've checked all transactions and found nothing for this poll_id
      return 'Unsubmitted';

    } catch (error) {
      console.error(`Error fetching vote status for voter ${voterAddress} and poll ${pollId}:`, error);
      throw error; // Let the caller handle the error
    }
  }

  async getSignatureStatus(
    verifierAddress: string, 
    sessionId: string
  ): Promise<'Yes' | 'Unsubmitted' | 'Invalid'> {
    try {
      let hasMorePages = true;
      let offset = 0;
      const limit = 10;

      while (hasMorePages) {
        const response = await this.axiosClient.get<SignatureResponse>(
          `${this.baseUrl}/cosmos/tx/v1beta1/txs`,
          {
            params: {
              'events': [
                `wasm-signature_submitted.participant='${verifierAddress}'`,
                `wasm-signature_submitted.session_id='${sessionId}'`
              ],
              'pagination.offset': offset,
              'pagination.limit': limit,
              'order_by': 'ORDER_BY_DESC'
            }
          }
        );

        // Check if there's any transaction for this session
        const signatureTx = response.data.tx_responses.find(tx => {
          const submitSig = tx.tx.body.messages[0].msg?.submit_signature;
          return submitSig && submitSig.session_id === sessionId;
        });

        if (signatureTx) {
          const signature = signatureTx.tx.body.messages[0].msg?.submit_signature?.signature;
          return signature ? 'Yes' : 'Invalid';
        }

        hasMorePages = !!response.data.pagination.next_key;
        offset += limit;

        const total = parseInt(response.data.pagination.total || '0');
        if (total <= offset) {
          break;
        }
      }

      return 'Unsubmitted';

    } catch (error) {
      console.error(`Error fetching signature status for verifier ${verifierAddress} and session ${sessionId}:`, error);
      throw error;
    }
  }
}