import {
  IWsEventMessageTxResult,
  TxResult,
} from "ws/interface/IWsEventMessageTx";

export class WsMessageTxResult implements IWsEventMessageTxResult {
  query: string;
  data: { type: string; value: TxResult };
  events: { [key: string]: string[] };

  constructor(params: IWsEventMessageTxResult) {
    const { query, data, events } = params;

    this.query = query;
    this.data = data;
    this.events = events;
  }

  getEventByKey(key: string): string | undefined {
    return this?.events?.[key]?.[0];
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
