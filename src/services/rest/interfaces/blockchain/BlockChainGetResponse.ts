export interface AxlBlockChainGetResponse {
  jsonrpc: string;
  id: number;
  result: {
    last_height: string;
    block_metas: BlockMeta[];
  };
}

interface BlockID {
  hash: string;
  parts: {
    total: number;
    hash: string;
  };
}

interface Header {
  version: {
    block: string;
  };
  chain_id: string;
  height: string;
  time: string;
  last_block_id: BlockID;
  last_commit_hash: string;
  data_hash: string;
  validators_hash: string;
  next_validators_hash: string;
  consensus_hash: string;
  app_hash: string;
  last_results_hash: string;
  evidence_hash: string;
  proposer_address: string;
}

interface BlockMeta {
  block_id: BlockID;
  block_size: string;
  header: Header;
  num_txs: string;
}
