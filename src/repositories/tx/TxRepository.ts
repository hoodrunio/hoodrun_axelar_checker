import { ITx, ITxDocument } from "@database/models/tx/tx.interface";
import TxDbModel from "@database/models/tx/tx.model";
import BaseRepository from "@repositories/base.repository";

export class TxRepository extends BaseRepository<ITx, ITxDocument> {
  constructor() {
    super(TxDbModel);
  }
}
