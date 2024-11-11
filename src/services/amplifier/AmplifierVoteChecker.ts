import { AxiosInstance } from 'axios';
import { AmplifierVoteType } from '@/types/amplifier';
import { IAmplifierPoll, IAmplifierVote, ITxResponse, ITxMessage } from '@/database/models/amplifier/interfaces';
import { AppDb } from '@/database/database';
import { logger } from '@/utils/logger';
import { AMPLIFIER_CONFIG } from '@/config/amplifier.config';
import { AmplifierPollState } from '@/database/models/amplifier/interfaces';
import { AmplifierVerifierService } from '@/services/amplifier/AmplifierVerifierService';
import { VoteTxInfo } from '@/repositories/amplifier/AmplifierVoteRepository';

export class AmplifierVoteChecker {
  private axios: AxiosInstance;
  private db: AppDb;
  private verifierService: AmplifierVerifierService;

  constructor(axiosInstance: AxiosInstance) {
    this.axios = axiosInstance;
    this.db = new AppDb();
    this.verifierService = AmplifierVerifierService.getInstance();
  }

  async checkVotes(pollId: string): Promise<void> {
    const poll = await this.db.amplifierPollRepo.findOne({ pollId });
    if (!poll) {
      logger.error(`Poll ${pollId} not found`);
      return;
    }
  
    const unsubmittedVotes = await this.db.amplifierVoteRepo.findUnsubmittedVotes(pollId);
    const checkPromises = unsubmittedVotes.map(vote => this.processVote(vote as unknown as IAmplifierVote));
    
    await Promise.allSettled(checkPromises);
    await this.updatePollState(poll as unknown as IAmplifierPoll);
  }

  private async processVote(vote: IAmplifierVote): Promise<void> {
    try {
      const voteStatus = await this.checkVoteStatus(vote.pollId);
      
      if (voteStatus !== vote.vote) {
        await this.updateVoteInDb(vote, voteStatus);
      }
    } catch (error) {
      logger.error(`Error processing vote for ${vote.voterAddress}:`, error);
    }
  }

  async checkVoteStatus(pollId: string): Promise<AmplifierVoteType> {
    try {
      if (!this.verifierService.isConfigured()) {
        return AmplifierVoteType.UNSUBMITTED;
      }

      const response = await this.getTxResponse(pollId);
      return this.processVoteResponse(response, pollId);
    } catch (error) {
      logger.error(`Error checking vote for poll ${pollId}:`, error);
      return AmplifierVoteType.UNSUBMITTED;
    }
  }

  private async getTxResponse(pollId: string): Promise<ITxResponse> {
    const verifierAddress = this.verifierService.getVerifierAddress();
    return await this.axios.get(
      `${AMPLIFIER_CONFIG.BASE_LCD_URL}/cosmos/tx/v1beta1/txs`,
      {
        params: {
          'events': `wasm-voted.voter='${verifierAddress}'`,
          'pagination.offset': 2,
          'pagination.count_total': true,
          'order_by': 'ORDER_BY_DESC'
        }
      }
    );
  }

  private findRelevantTx(txs: ITxResponse['data']['txs'], pollId: string) {
    return txs.find(tx =>
      tx.body.messages.some(msg => 
        msg?.msg?.vote?.poll_id === pollId
      )
    );
  }

  private processVoteResponse(response: ITxResponse, pollId: string): AmplifierVoteType {
    if (!response.data?.txs?.length) {
      return AmplifierVoteType.UNSUBMITTED;
    }

    const relevantTx = this.findRelevantTx(response.data.txs, pollId);
    return relevantTx ? this.determineVoteType(relevantTx) : AmplifierVoteType.UNSUBMITTED;
  }

  private determineVoteType(tx: ITxResponse['data']['txs'][0]): AmplifierVoteType {
    const voteMsg = tx.body.messages.find(
      msg => msg['@type'] === '/cosmwasm.wasm.v1.MsgExecuteContract'
    );

    if (!voteMsg?.msg?.vote?.votes) {
      return AmplifierVoteType.UNSUBMITTED;
    }

    return voteMsg.msg.vote.votes.includes('succeeded_on_chain') 
      ? AmplifierVoteType.YES 
      : AmplifierVoteType.NO;
  }

  async getVoteTxInfo(voterAddress: string, pollId: string): Promise<VoteTxInfo | undefined> {
    try {
      const response = await this.axios.get(
        `${AMPLIFIER_CONFIG.BASE_LCD_URL}/cosmos/tx/v1beta1/txs`,
        {
          params: {
            'events': `wasm-voted.voter='${voterAddress}'`,
            'pagination.offset': 2,
            'pagination.count_total': true,
            'order_by': 'ORDER_BY_DESC'
          }
        }
      );
  
      if (response.data?.tx_responses) {
        // Find the transaction for the specific poll
        const relevantTxResponse = response.data.tx_responses.find((tx: any) => {
          const events = tx.events || [];
          return events.some((event: any) => {
            if (event.type === 'wasm-voted') {
              const pollIdAttr = event.attributes.find(
                (attr: any) => Buffer.from(attr.key, 'base64').toString() === 'poll_id'
              );
              return pollIdAttr && 
                Buffer.from(pollIdAttr.value, 'base64').toString() === pollId;
            }
            return false;
          });
        });
  
        if (relevantTxResponse) {
          return {
            txHash: relevantTxResponse.txhash,
            txHeight: parseInt(relevantTxResponse.height)
          };
        }
      }
  
      logger.debug(`No transaction found for voter ${voterAddress} and poll ${pollId}`);
      return undefined;
    } catch (error) {
      logger.error(`Error getting tx info for ${voterAddress} and poll ${pollId}:`, error);
      return undefined;
    }
  }

  private async updatePollState(poll: IAmplifierPoll): Promise<void> {
    const allVotes = await this.db.amplifierVoteRepo.find({ pollId: poll.pollId });
    const unsubmittedCount = allVotes.filter(v => (v as unknown as IAmplifierVote).vote === AmplifierVoteType.UNSUBMITTED).length;

    if (unsubmittedCount === 0 || Date.now() > poll.expiresAt) {
      await this.db.amplifierPollRepo.updateOne(
        { pollId: poll.pollId },
        { pollState: AmplifierPollState.COMPLETED }
      );
    }
  }

  async updateVoteInDb(vote: IAmplifierVote, voteStatus: AmplifierVoteType): Promise<void> {
    let txInfo: VoteTxInfo | undefined;
    
    if (voteStatus !== AmplifierVoteType.UNSUBMITTED) {
      const voteTxInfo = await this.getVoteTxInfo(vote.voterAddress, vote.pollId);
      if (voteTxInfo) {
        txInfo = {
          txHash: voteTxInfo.txHash,
          txHeight: voteTxInfo.txHeight
        };
      }
    }

    await this.db.amplifierVoteRepo.updateVoteStatus(
      vote.customId,
      voteStatus,
      txInfo
    );
  }
}