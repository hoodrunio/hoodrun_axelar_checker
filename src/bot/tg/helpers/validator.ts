export const elipsized = (str: string, treshold: number): string => {
  return str.length > treshold ? "..." + str.slice(treshold, str.length) : str;
};
