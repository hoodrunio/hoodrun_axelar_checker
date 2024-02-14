import { AxelarQueryService } from "@services/rest/AxelarQueryService";

interface HandleBlockResultsForPollParams {
  startHeight: number;
  endHeight: number;
}
export const handleBlockResultsForPoll = async (
  params: HandleBlockResultsForPollParams
) => {
  const axlQService = new AxelarQueryService();

  const { startHeight, endHeight } = params;
  for (let currHeight = startHeight; currHeight <= endHeight; currHeight++) {
    const blockResult = await axlQService.getBlockResultWithHeight(11355626);
    // const polls = new BlockResult(blockResult.result).extractPolls();
    // const pollVotes = new BlockResult(blockResult.result).extractPollVotes();
    const a = 1;
  }
};
