import appConfig from "@config/index";

// Get thresholds from config, which loads from environment variables
const {
  uptimeThreshold: { low, medium, high },
} = appConfig;

export enum UptimeThreshold {
  LOW = low,
  MEDIUM = medium,
  HIGH = high,
}

export const createUptimeCondition = (params: {
  operatorAddress: string;
  uptime: number | { toString(): string };
}): { value: string; threshold: number } => {
  const { operatorAddress, uptime } = params;
  
  // Convert uptime to number, handling both string and object cases
  const uptimeValue = typeof uptime === 'object' && uptime.toString ? 
    parseFloat(uptime.toString()) : 
    Number(uptime);

  let thRes = UptimeThreshold.HIGH;
  let thText = "optimal";

  // Compare with exact threshold values
  switch (true) {
    case uptimeValue < UptimeThreshold.LOW: // < 99.7%
      thRes = UptimeThreshold.LOW;
      thText = "critical";
      break;
    case uptimeValue < UptimeThreshold.MEDIUM: // < 99.8%
      thRes = UptimeThreshold.MEDIUM;
      thText = "warning";
      break;
    case uptimeValue < UptimeThreshold.HIGH: // < 99.9%
      thRes = UptimeThreshold.HIGH;
      thText = "attention";
      break;
  }

  // Format the uptime value after conversion
  const formattedUptime = uptimeValue.toFixed(3);
  
  return {
    value: `${operatorAddress}_${formattedUptime}_${thText}_${thRes}`,
    threshold: thRes,
  };
};
