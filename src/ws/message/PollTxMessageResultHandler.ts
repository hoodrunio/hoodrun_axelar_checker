import { PollStateEnum } from "@database/models/polls/poll/poll.interface";
import { addNewWsPollAndVoteAddJob } from "queue/jobs/poll/NewWsPollAndVoteAddJob";
import {
  NewWsPollDataTypeEnum,
  NewWsPollDto,
  NewWsPollVoteDto,
} from "queue/jobs/poll/dto/NewWsPollDtos";
import { IParticipantsData } from "ws/event/ParticipantsData";
import {
  ActivePollEvents,
  ActivePollVotedEvents,
  PollSendEvent,
} from "ws/event/PollSendEvent";
import { WsMessageTxResult } from "./WsMessageTxResult";

export class PollTxMessageResultHandler {
  public handle(messageTxResult: WsMessageTxResult) {
    const pollSendEvent = this.extractWhichPollEventMessage(messageTxResult);

    if (!pollSendEvent) return;

    if (this.isPollEventMessage(messageTxResult)) {
      this.handleOnPollTxMessage(messageTxResult, pollSendEvent);
    }

    if (this.isPollEventVotedMessage(messageTxResult)) {
      this.handleOnPollVotedMessage(messageTxResult);
    }
  }
  private extractWhichPollEventMessage(
    result: WsMessageTxResult
  ): PollSendEvent | undefined {
    const allEvents = { ...ActivePollEvents, ...ActivePollVotedEvents };
    const pollEvent = Object.values(allEvents).find(
      (event) => event.getQuery() === result.query
    );
    return pollEvent;
  }

  private isAnyPollEventMessage(
    result: WsMessageTxResult,
    events: { [x: string]: PollSendEvent }
  ) {
    return Object.values(events).some(
      (event) => event.getQuery() === result.query
    );
  }

  private isPollEventMessage(result: WsMessageTxResult) {
    return this.isAnyPollEventMessage(result, ActivePollEvents);
  }

  private isPollEventVotedMessage(result: WsMessageTxResult) {
    return ActivePollVotedEvents.Voted.getQuery() === result.query;
  }

  private handleOnPollVotedMessage(result: WsMessageTxResult) {
    const pollIdKey = "axelar.vote.v1beta1.Voted.poll";
    const pollStateKey = "axelar.vote.v1beta1.Voted.state";
    const voterAddressKey = "axelar.vote.v1beta1.Voted.voter";

    // POLL_STATE_COMPLETED, POLL_STATE_PENDING, POLL_STATE_FAILED maybe more don't know
    // Check if state not pending
    const pollState = result?.getEventByKey(pollStateKey);
    const pollId = result?.getEventByKey(pollIdKey);
    const txHash = result?.getTxHash();
    const txHeight = result?.getTxHeight();
    const voterAddress = result?.getEventByKey(voterAddressKey);
    if (!pollId || !pollState || !txHeight || !txHash || !voterAddress) {
      console.log("missing data one of the keys", {
        pollId,
        pollState,
        txHeight,
        txHash,
        voterAddress,
      });
      return;
    }

    const newPollVoteData: Omit<NewWsPollVoteDto, "vote"> = {
      pollId,
      pollState,
      voter_address: voterAddress,
      txHash,
      txHeight,
    };

    addNewWsPollAndVoteAddJob({
      type: NewWsPollDataTypeEnum.NEW_POLL_VOTE,
      data: newPollVoteData,
    });
  }

  private handleOnPollTxMessage(
    result: WsMessageTxResult,
    pollEvent: PollSendEvent
  ) {
    const chainKey = pollEvent.axelarEvmVKeyWithSuffix("chain");
    const partsObjKey = pollEvent.axelarEvmVKeyWithSuffix("participants");

    const pollChain = result?.getEventByKey(chainKey);
    const txHash = result?.getTxHash();
    const txHeight = result?.getTxHeight();
    const participantObject = result?.getEventByKey(partsObjKey);
    if (!pollChain || !txHeight || !participantObject || !txHash) {
      console.log("missing data one of the keys", {
        pollChain,
        txHeight,
        participantObject,
        txHash,
      });
      return;
    }

    const { participants, poll_id: pollId }: IParticipantsData =
      JSON.parse(participantObject);
    if (!participants || !pollId) {
      console.log("missing data one of the keys", {
        participants,
        pollId,
      });
      return;
    }
    const newPollJobDto: NewWsPollDto = {
      pollId,
      pollChain,
      pollState: PollStateEnum.POLL_STATE_PENDING,
      participants,
      txHash,
      txHeight,
    };

    addNewWsPollAndVoteAddJob({
      type: NewWsPollDataTypeEnum.NEW_POLL,
      data: newPollJobDto,
    });
  }
}
