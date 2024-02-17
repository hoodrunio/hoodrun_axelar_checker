class QueryHelper {
  constructor(private prefix: string, private separator: string) {
    if (prefix.length + separator.length > 12) {
      throw new Error(
        "Prefix and separator length should be less than 12 characters"
      );
    }
  }

  queryExtractor(text: string): string | null {
    const regex = new RegExp(`^${this.prefix}${this.separator}(.+)`);
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  queryBuilder(value: string): string {
    return `${this.prefix}${this.separator}${value}`;
  }

  get event() {
    return new RegExp(`^${this.prefix}${this.separator}(.+)$`);
  }
}

export const TgQuery = {
  UpTime: new QueryHelper("upTime", ":"),
  ValActions: new QueryHelper("valActions", ":"),
  EvmSupChains: new QueryHelper("evmChains", ":"),
  Last30Votes: new QueryHelper("last30Votes", ":"),
  RpcHealth: new QueryHelper("rpcHealth", ":"),
};
