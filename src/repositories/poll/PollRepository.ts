import {
  IPoll,
  IPollDocument,
} from "@database/models/polls/poll/poll.interface";
import PollDbModel from "@database/models/polls/poll/poll.model";
import BaseRepository from "@repositories/base.repository";

export class PollRepository extends BaseRepository<IPoll, IPollDocument> {
  constructor() {
    super(PollDbModel);
  }
}
