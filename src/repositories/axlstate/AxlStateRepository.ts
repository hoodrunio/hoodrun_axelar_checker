import {
  IAxlState,
  IAxlStateDocument,
} from "@database/models/axlstate/axlstate.interface";
import AxlStateDbModel from "@database/models/axlstate/axlstate.model";
import BaseRepository from "@repositories/base.repository";

const AxlStateCustomId = "axlstate";

export class AxlStateRepository {
  private repo: BaseRepository<IAxlState, IAxlStateDocument>;
  constructor() {
    this.repo = new BaseRepository(AxlStateDbModel);
  }

  async upsertState(data: Omit<IAxlState, "custom_id">) {
    return this.repo.upsertOne({ customId: AxlStateCustomId }, { ...data });
  }
  async getState(): Promise<IAxlStateDocument | null> {
    const res = await this.repo.findOne({ customId: AxlStateCustomId });
    return res;
  }
  async updateLatestHeight(height: number) {
    const currentState = await this.getState();
    const latestPollCheckHeight = currentState?.latestPollCheckHeight ?? 0;
    return this.upsertState({ latestHeight: height, latestPollCheckHeight });
  }

  async updateLatestPollCheckHeight(height: number) {
    const currentState = await this.getState();
    const latestHeight = currentState?.latestHeight ?? 0;
    return this.upsertState({ latestHeight, latestPollCheckHeight: height });
  }
}
