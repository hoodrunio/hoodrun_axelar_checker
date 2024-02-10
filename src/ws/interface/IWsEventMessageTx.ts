export interface EventAttribute {
  key: string;
  value: string;
  index?: boolean;
}

export interface Event {
  "@type": string;
  attributes: EventAttribute[];
}

export interface TxResultData {
  data: string;
  log: string;
  gas_wanted: string;
  gas_used: string;
  events: Event[];
}

export interface TxResult {
  height: string;
  index: number;
  tx: string;
  result: TxResultData;
}

export interface IWsEventMessageTxResult {
  query: string;
  data: {
    type: string;
    value: TxResult;
  };
  events: { [key: string]: string[] };

  getEventByKey(key: string): string | undefined;
}
