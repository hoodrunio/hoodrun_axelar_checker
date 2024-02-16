import {
  IWsEventMessageTxResult,
  ITxResult,
} from "ws/interface/IWsEventMessageTx";

export class WsMessageTxResult {
  raw: string;
  query: string;
  data: { type: string; value: { TxResult: ITxResult } };
  events: { [key: string]: string[] };

  constructor(params: IWsEventMessageTxResult, raw: string) {
    const { query, data, events } = params;
    this.raw = raw;
    this.query = query;
    this.data = data;
    this.events = events;
  }

  getEventByKey(key: string): string | undefined {
    const event = this?.events?.[key]?.[0]?.replace(/^"|"$/g, "");
    return event;
  }

  getTxHeight(): number | undefined {
    const txHeightString = this.getEventByKey(this.txHeightKey());
    return txHeightString ? parseInt(txHeightString) : undefined;
  }

  getTxHash(): string | undefined {
    return this.getEventByKey(this.txHashKey());
  }

  private txHeightKey(): string {
    return "tx.height";
  }

  private txHashKey(): string {
    return "tx.hash";
  }
}

export class TxResult {
  height: string;
  index: number;
  tx: string;
  result: TxResultData;
  constructor(height: string, index: number, tx: string, result: TxResultData) {
    this.height = height;
    this.index = index;
    this.tx = tx;
    this.result = result;
  }
}

export class TxResultData {
  constructor(
    public data: string,
    public log: string,
    public gas_wanted: string,
    public gas_used: string,
    public events: Event[]
  ) {}
}

export class EventAttribute {
  constructor(
    public key: string,
    public value: string,
    public index?: boolean
  ) {}
}

export class Event {
  "@type": string;
  attributes: EventAttribute[];
  constructor(type: string, attributes: EventAttribute[]) {
    this["@type"] = type;
    this.attributes = attributes;
  }
}
