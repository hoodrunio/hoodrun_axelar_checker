import { IParticipantsData, ParticipantsData } from "ws/event/ParticipantsData";
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

  private handleOnPollVotedMessage(result: WsMessageTxResult) {}

  private handleOnPollTxMessage(
    result: WsMessageTxResult,
    pollEvent: PollSendEvent
  ) {
    const chainKey = pollEvent.axelarEvmVKeyWithSuffix("chain");
    const partsObjKey = pollEvent.axelarEvmVKeyWithSuffix("participants");
    const txHeightKey = `tx.height`;

    const pollChain = result?.getEventByKey(chainKey);
    const txHeight = result?.getEventByKey(txHeightKey);
    const participantObject = result?.getEventByKey(partsObjKey);
    if (!pollChain || !txHeight || !participantObject) return;

    const { participants, poll_id }: IParticipantsData =
      JSON.parse(participantObject);
    if (!participants || !poll_id) return;

    const participantData = new ParticipantsData(poll_id, participants);
    //Need to save to db
  }
}
