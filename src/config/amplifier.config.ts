export const AMPLIFIER_CONFIG = {
  VOTE_CHECK_INTERVAL: 5000, // 5 seconds
  VOTE_CHECK_MAX_RETRIES: 3,
  POLL_EXPIRY_TIME: 15 * 60 * 1000, // 15 minutes
  WS_RECONNECT_INTERVAL: 1000,
  BASE_RPC_URL: process.env.AXELAR_RPC_URL || 'https://axelar-rpc.qubelabs.io:443',
  BASE_LCD_URL: process.env.AXELAR_LCD_URL || 'https://axelar-lcd.qubelabs.io:443',
  VERIFIER_ADDRESS: process.env.VERIFIER_ADDRESS,
  MAX_LAST_X_HOUR_POLL_VOTE_NOTIFICATION: 24,
};

export const AMPLIFIER_QUEUE_NAMES = {
  VOTE_CHECK: 'amplifier-vote-check',
  NOTIFICATION: 'amplifier-notification',
};