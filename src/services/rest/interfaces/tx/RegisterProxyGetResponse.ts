import { Transaction } from "@/services/rest/interfaces/tx/Transaction";

export interface RegisterProxyGetResponse {
  txs: Transaction[];
}
