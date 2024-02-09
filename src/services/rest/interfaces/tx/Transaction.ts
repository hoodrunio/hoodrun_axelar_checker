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
  proxy_addr: string;
}
