import appConfig from "@config/index";

const {
  uptimeThreshold: { low = 0.7, medium = 0.85, high = 0.985 },
} = appConfig;
export enum UptimeThreshold {
  LOW = low,
  MEDIUM = medium,
  HIGH = high,
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
