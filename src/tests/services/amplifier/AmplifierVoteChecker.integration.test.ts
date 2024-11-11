import { AmplifierVoteChecker } from '@services/amplifier/AmplifierVoteChecker';
import { AmplifierVerifierService } from '@services/amplifier/AmplifierVerifierService';
import { AmplifierVoteType } from 'types/amplifier';
import { AmplifierPollState } from '@database/models/amplifier/interfaces';
import { AppDb } from '@database/database';
import axios, { AxiosInstance } from 'axios';
import { AmplifierPollRepository } from '@repositories/amplifier/AmplifierPollRepository';
import { AmplifierVoteRepository } from '@repositories/amplifier/AmplifierVoteRepository';

describe('AmplifierVoteChecker Integration Test', () => {
  let voteChecker: AmplifierVoteChecker;
  let axiosInstance: AxiosInstance;
  let verifierService: AmplifierVerifierService;
  let db: AppDb;

  beforeAll(() => {
    // Initialize Axios instance with base URL
    axiosInstance = axios.create({
      baseURL: 'https://axelar-rpc.qubelabs.io:443' // Replace with actual mainnet URL if needed
    });

    // Mock verifier service
    verifierService = AmplifierVerifierService.getInstance();
    jest.spyOn(verifierService, 'isConfigured').mockReturnValue(true);
    jest.spyOn(verifierService, 'getVerifierAddress').mockReturnValue('axelar1verifieraddress'); // Replace with actual verifier address

    // Initialize AmplifierVoteChecker
    voteChecker = new AmplifierVoteChecker(axiosInstance);

    // Initialize database and repositories
    db = new AppDb();
  });

  afterAll(async () => {
    // Close any database connections if necessary
    await db.close();
  });

  it('should process votes correctly for a given poll', async () => {
    // Setup: Insert a poll into the database
    const pollId = '47'; // Replace with a real poll ID
    const amplifierPollRepo = db.amplifierPollRepo as AmplifierPollRepository;
    const amplifierVoteRepo = db.amplifierVoteRepo as AmplifierVoteRepository;

    await amplifierPollRepo.upsertOne(
      { pollId },
      {
        pollId,
        confirmationHeight: 10000,
        expiresAt: Date.now() + 3600000, // Expires in 1 hour
        messages: [],
        participants: ['axelar1verifieraddress'],
        pollState: AmplifierPollState.ACTIVE,
        sourceChain: 'flow',
        sourceGatewayAddress: '0xSourceGatewayAddress'
      }
    );

    // Insert a vote with UNSUBMITTED status
    await amplifierVoteRepo.create({
      customId: `${pollId}_axelar1verifieraddress`,
      pollId,
      voterAddress: 'axelar1verifieraddress',
      vote: AmplifierVoteType.UNSUBMITTED,
      checkedForNotification: false
    });

    // Mock the Axios response for the vote check
    jest.spyOn(axiosInstance, 'get').mockImplementation((url, config) => {
      if (url.includes('/cosmos/tx/v1beta1/txs')) {
        // Mock response for the vote transaction
        return Promise.resolve({
          data: {
            txs: [
              {
                body: {
                  messages: [
                    {
                      '@type': '/cosmwasm.wasm.v1.MsgExecuteContract',
                      msg: {
                        vote: {
                          poll_id: pollId,
                          votes: ['succeeded_on_chain']
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        });
      }
      return axios.get(url, config);
    });

    // Execute the vote check
    await voteChecker.checkVotes(pollId);

    // Assertions
    const updatedVote = await amplifierVoteRepo.findOne({
      customId: `${pollId}_axelar1verifieraddress`
    });
    expect(updatedVote?.vote).toBe(AmplifierVoteType.YES);

    const updatedPoll = await amplifierPollRepo.findOne({ pollId });
    expect(updatedPoll?.pollState).toBe(AmplifierPollState.COMPLETED);
  });
});
