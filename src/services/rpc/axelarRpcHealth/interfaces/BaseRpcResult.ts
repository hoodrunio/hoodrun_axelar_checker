export interface BaseRpcResult<T> {
  jsonrpc: string;
  result: T;
  id: number;
}
