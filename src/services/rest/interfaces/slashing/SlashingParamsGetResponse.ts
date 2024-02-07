export interface SlashingParamsGetResponse {
  params: SlashingParams;
}

interface SlashingParams {
  signed_blocks_window: string;
  min_signed_per_window: string;
  downtime_jail_duration: string;
  slash_fraction_double_sign: string;
  slash_fraction_downtime: string;
}
