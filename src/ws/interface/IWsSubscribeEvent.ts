export interface IWsSubscribeEventType {
  jsonrpc: string;
  method: string;
  id: string;
  params: {
    query: string;
  };
}
