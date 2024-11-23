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

  private processMessages(messages: any[]): any[] {
    const processedMessages: any[] = [];
    
    for (const message of messages) {
      if (message['@type'] === '/cosmwasm.wasm.v1.MsgExecuteContract') {
        processedMessages.push(message);
      } else if (message['@type'] === '/axelar.auxiliary.v1beta1.BatchRequest' && Array.isArray(message.messages)) {
        // For devnet: extract messages from BatchRequest
        processedMessages.push(...message.messages);
      }
    }
    
    return processedMessages;
  }

  async getVoteStatus(voterAddress: string, pollId: string): Promise<VoteType> {
    try {
      const url = `${this.baseUrl}/cosmos/tx/v1beta1/txs`;
      
      let offset = 0;
      const limit = 100;
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

        if (offset === 0) {
          total = parseInt(response.data.pagination.total || '0');
        }

        for (const txResponse of response.data.tx_responses) {
          const messages = this.processMessages(txResponse.tx.body.messages);
          
          for (const message of messages) {
            if (message['@type'] === '/cosmwasm.wasm.v1.MsgExecuteContract') {
              const voteMsg = message.msg?.vote;
              if (voteMsg && voteMsg.poll_id === pollId) {
                const votes = voteMsg.votes || [];
                return votes.includes('succeeded_on_chain') ? VoteType.YES : VoteType.NO;
              }
            }
          }
        }

        offset += limit;
      } while (offset < total);

      return VoteType.UNSUBMITTED;

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

        for (const txResponse of response.data.tx_responses) {
          const messages = this.processMessages(txResponse.tx.body.messages);
          
          for (const message of messages) {
            if (message['@type'] === '/cosmwasm.wasm.v1.MsgExecuteContract' && message.sender === verifierAddress) {
              const submissionMsg = message.msg?.submit_signature;
              if (submissionMsg && submissionMsg.session_id === sessionId) {
                return submissionMsg.signature ? SignatureType.YES : SignatureType.INVALID;
              }
            }
          }
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