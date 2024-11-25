const voterAddressPattern = /^axelar[0-9a-z]{39}$/;
const operatorAddressPattern = /^axelarvaloper[0-9a-z]{39}$/;

export const isValidVoterAddress = (voterAddress: string): boolean => {
  const regex = new RegExp(voterAddressPattern);
  return regex.test(voterAddress);
};

export const isValidOperatorAddress = (operatorAddress: string): boolean => {
  const regex = new RegExp(operatorAddressPattern);
  return regex.test(operatorAddress);
};
