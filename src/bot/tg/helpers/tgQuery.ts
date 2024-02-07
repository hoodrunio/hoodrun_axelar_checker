import { TgQuery } from "../Commands";

const queryExtractor = (
  prefix: string,
  separator: string,
  text: string
): string | null => {
  const regex = new RegExp(`^${prefix}${separator}(.+)`);
  const match = text.match(regex);
  return match ? match[1] : null;
};

export const queryBuilder = (
  prefix: string,
  separator: string,
  value: string
): string => {
  return `${prefix}${separator}${value}`;
};

export const uptimeQueryExtractor = (text: string): string | null => {
  return queryExtractor(TgQuery.UpTime.prefix, TgQuery.UpTime.separator, text);
};

export const uptimeQueryBuilder = (text: string): string | null => {
  return queryBuilder(TgQuery.UpTime.prefix, TgQuery.UpTime.separator, text);
};
