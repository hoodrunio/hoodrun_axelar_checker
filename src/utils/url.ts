// Function to validate if a URL is safe
export const isSafeUrl = (url: string): boolean => {
  const regex = /^(https?|wss):\/\/[^\s/$.?#].[^\s]*$/i;
  return regex.test(url);
};
