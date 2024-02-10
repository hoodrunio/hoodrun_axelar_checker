export interface IWsEventData<T> {
  jsonrpc: string;
  id: string;
  result: T;
}
