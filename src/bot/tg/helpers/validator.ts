export const elipsized = (str: string, treshold: number): string => {
  return str.length > treshold ? str.slice(0, treshold) + "..." : str;
};
