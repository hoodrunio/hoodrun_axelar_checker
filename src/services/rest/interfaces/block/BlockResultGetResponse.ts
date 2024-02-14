import {
  IPoll,
  PollStateEnum,
} from "@database/models/polls/poll/poll.interface";
import { IParticipantsData } from "ws/event/ParticipantsData";
import { PollEvent } from "ws/event/eventHelper";
import { IBlockResult, IBlockResultTxResult, IEvent } from "./IBlockResult";
import {
  IPollVote,
  PollVoteType,
} from "@database/models/polls/poll_vote/poll_vote.interface";

type OmittedIPoll = Omit<IPoll, "txHash" | "txHeight" | "pollState">;

export interface BlockResultGetResponse {
  jsonrpc: string;
  id: number;
  result: IBlockResult;
}

export class BlockResult {
  height: string;
  txs_results: BlockResultTxResult[] | undefined;
  domainPolls: IPoll[] = [];
  domainPollVotes: IPollVote[] = [];

  constructor(blockResult: IBlockResult) {
    this.height = blockResult.height;
    this.txs_results = blockResult.txs_results?.map(
      (el) => new BlockResultTxResult(el)
    );
  }

  heightAsNumber(): number {
    return parseInt(this.height);
  }

  txResults(): BlockResultTxResult[] {
    return this.txs_results ?? [];
  }

  extractDomainPollDataFromPollStartedEvent = (event: Event): OmittedIPoll => {
    const pollChain = event.attributes.find(
      (attr) => attr.key === "chain"
    )?.value;

    if (!pollChain) {
      throw new Error("Poll chain not found in event");
    }

    const participantStringObj: string | undefined = event.attributes.find(
      (attr) => attr.key === "participants"
    )?.value;

    if (!participantStringObj) {
      throw new Error("Participants string not found in event");
    }

    const participantsObj: IParticipantsData = JSON.parse(participantStringObj);
    const { participants, poll_id } = participantsObj;

    const poll: OmittedIPoll = {
      pollId: poll_id,
      pollChain,
      participants,
    };
    return poll;
  };

  getDomainPollFromStartedEvent = (event: Event): IPoll | null => {
    const startedEvents = [
      PollEvent.ConfirmDepositStarted,
      PollEvent.ConfirmKeyTransferStarted,
      PollEvent.ConfirmGatewayTxStarted,
    ];

    const startedEvent = startedEvents.find(
      (startedEvent) => `axelar.evm.v1beta1.${startedEvent}` === event.type
    );
    if (!startedEvent) {
      return null;
    }

    const omittedDomainPoll =
      this.extractDomainPollDataFromPollStartedEvent(event);
    const result: IPoll = {
      ...omittedDomainPoll,
      pollState: PollStateEnum.POLL_STATE_PENDING,
      txHash: "",
      txHeight: this.heightAsNumber(),
    };

    return result;
  };

  getDomainPollVoteFromEvent = (event: Event): IPollVote | null => {
    const voteEvents = [PollEvent.Voted];
    const voteEvent = voteEvents.find(
      (voteEvent) => `axelar.vote.v1beta1.${voteEvent}` === event.type
    );
    if (!voteEvent) {
      return null;
    }

    const pollId = event.attributes.find((attr) => attr.key === "poll")?.value;
    if (!pollId) {
      throw new Error("Poll id not found in event");
    }

    const voter = event.attributes.find((attr) => attr.key === "voter")?.value;
    if (!voter) {
      throw new Error("Voter not found in event");
    }

    const pollState = event.attributes.find(
      (attr) => attr.key === "state"
    )?.value;
    if (!pollState) {
      throw new Error("Poll state not found in event");
    }

    //TEMP
    const pollVote: IPollVote = {
      pollId,
      voter_address: voter,
      txHash: "",
      txHeight: this.heightAsNumber(),
      pollState: "",
      vote: PollVoteType.NO,
    };

    return pollVote;
  };

  checkPollAndPollVotes = (events: Event[]) => {
    for (const event of events) {
      const poll = this.getDomainPollFromStartedEvent(event);
      if (poll) {
        this.domainPolls.push(poll);
      }

      const pollVote = this.getDomainPollVoteFromEvent(event);
      if (pollVote) {
        this.domainPollVotes.push(pollVote);
      }
    }
  };

  extractPollsWithVotes() {
    const polls: IPoll[] = [];
    const pollVotes: IPollVote[] = [];

    if (!this.txs_results) {
      return { polls, pollVotes };
    }

    for (const txResult of this.txs_results) {
      const txLog = txResult.log;
      if (!txLog) {
        continue;
      }

      const parsedLogs: { log?: string; events?: Event[] }[] = JSON.parse(
        txLog ?? "{}"
      );

      if (!parsedLogs || parsedLogs.length < 1) {
        continue;
      }

      parsedLogs.forEach((parsedLog) => {
        const currLogEvents = parsedLog?.events ?? [];
        this.checkPollAndPollVotes(currLogEvents);
      });
    }
  }
}

export class BlockResultTxResult {
  code?: number;
  data?: string;
  log?: string;
  info?: string;
  gas_wanted?: string;
  gas_used?: string;
  events?: Event[];
  codespace?: string;

  constructor(el: IBlockResultTxResult) {
    this.code = el.code;
    this.data = el.data;
    this.log = el.log;
    this.info = el.info;
    this.gas_wanted = el.gas_wanted;
    this.gas_used = el.gas_used;
    this.codespace = el.codespace;
    this.events = el.events?.map(
      (event) => new Event(event["@type"], event.attributes)
    );
  }
}

export class Event {
  constructor(public type: string, public attributes: Attribute[]) {
    this.attributes = attributes.map(
      (attr) => new Attribute(attr.key, attr.value, attr.index)
    );
  }
}

export class Attribute {
  constructor(
    public key: string,
    public value: string,
    public index: boolean
  ) {}
}
