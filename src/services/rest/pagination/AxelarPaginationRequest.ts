export class AxelarPaginationRequest {
  limit: number;
  count_total: boolean;

  constructor({ limit }: { limit: number }) {
    this.limit = limit;
    this.count_total = true;
  }

  asRequestParams() {
    return {
      "pagination.limit": this.limit,
      "pagination.count_total": this.count_total,
    };
  }
}
