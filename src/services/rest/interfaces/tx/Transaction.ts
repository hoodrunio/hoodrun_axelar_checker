export interface Transaction {
  body: Body;
  auth_info: AuthInfo;
  signatures: string[];
}

interface AuthInfo {
  signer_infos: SignerInfo[];
  fee: Fee;
}

interface Fee {
  amount: Amount[];
  gas_limit: string;
  payer: string;
  granter: string;
}

interface Amount {
  denom: string;
  amount: string;
}

interface SignerInfo {
  public_key: PublicKey;
  mode_info: ModeInfo;
  sequence: string;
}

interface ModeInfo {
  single: Single;
}

interface Single {
  mode: string;
}

interface PublicKey {
  "@type": string;
  key: string;
}

interface Body {
  messages: Message[];
  memo: string;
  timeout_height: string;
  extension_options: any[];
  non_critical_extension_options: any[];
}

interface Message {
  "@type": string;
  sender: string;
  proxy_addr?: string;
  inner_message?: InnerMessage;
}

interface InnerMessage {
  "@type": string;
  sender: string;
  poll_id: string;
  vote?: Vote;
}

interface Vote {
  "@type": string;
  chain: string;
  events: Event[];
}

interface Event {
  chain: string;
  tx_id: number[];
  index: string;
  status: string;
  contract_call_with_token: ContractCallWithToken;
}

interface ContractCallWithToken {
  sender: number[];
  destination_chain: string;
  contract_address: string;
  payload_hash: number[];
  symbol: string;
  amount: string;
}
