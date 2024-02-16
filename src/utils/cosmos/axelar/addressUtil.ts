const voterAddressPattern = /^axelar[0-9a-z]{47}$/;
export const isValidVoterAddress = (voterAddress: string): boolean => {
  const regex = new RegExp(voterAddressPattern);
  return regex.test(voterAddress);
};
