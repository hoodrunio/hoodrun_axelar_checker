export interface IBlockResult {
  height: string;
  txs_results: IBlockResultTxResult[] | null;
}

export interface IBlockResultTxResult {
  code?: number;
  data?: string;
  log?: string;
  info?: string;
  gas_wanted?: string;
  gas_used?: string;
  events?: IEvent[];
  codespace?: string;
}

export interface IEvent {
  "@type": string;
  attributes: IAttribute[];
}

export interface IAttribute {
  key: string;
  value: string;
  index: boolean;
}
