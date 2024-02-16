export interface IEventAttribute {
  key: string;
  value: string;
  index?: boolean;
}

export interface IEvent {
  "@type": string;
  attributes: IEventAttribute[];
}

export interface ITxResultData {
  data: string;
  log: string;
  gas_wanted: string;
  gas_used: string;
  events: IEvent[];
}

export interface ITxResult {
  height: string;
  index: number;
  tx: string;
  result: ITxResultData;
}

export interface IWsEventMessageTxResult {
  query: string;
  data: {
    type: string;
    value: { TxResult: ITxResult };
  };
  events: { [key: string]: string[] };

  getEventByKey(key: string): string | undefined;
}
