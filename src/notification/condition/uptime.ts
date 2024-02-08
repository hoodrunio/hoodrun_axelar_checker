export enum UptimeThreshold {
  LOW = 0.7,
  MEDIUM = 0.85,
  HIGH = 0.985,
}

export const createUptimeCondition = (params: {
  operatorAddress: string;
  uptime: number;
}): { value: string; threshold: number } => {
  const { operatorAddress, uptime } = params;
  let thRes = UptimeThreshold.HIGH;
  let thText = "lower";

  switch (true) {
    case uptime < UptimeThreshold.LOW:
      thRes = UptimeThreshold.LOW;
      break;
    case uptime < UptimeThreshold.MEDIUM:
      thRes = UptimeThreshold.MEDIUM;
      break;
    case uptime < UptimeThreshold.HIGH:
      thRes = UptimeThreshold.HIGH;
      break;
    default:
      thText = "higher";
      break;
  }

  return {
    value: `${operatorAddress}_${uptime}_${thText}_${thRes}`,
    threshold: thRes,
  };
};
