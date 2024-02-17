import { Transaction } from "@/services/rest/interfaces/tx/Transaction";

export interface TransactionGetResponse {
  tx: Transaction;
  tx_response: any;
}
