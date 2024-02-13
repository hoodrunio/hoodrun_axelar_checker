import { IPoll } from "@database/models/polls/poll/poll.interface";
import { IPollVote } from "@database/models/polls/poll_vote/poll_vote.interface";

export interface NewWsPollDto extends IPoll {}
export interface NewWsPollVoteDto extends IPollVote {}

export enum NewWsPollDataTypeEnum {
  NEW_POLL = "NEW_POLL",
  NEW_POLL_VOTE = "NEW_POLL_VOTE",
}
export type NewWsPollAndVoteDto =
  | {
      type: NewWsPollDataTypeEnum.NEW_POLL;
      data: NewWsPollDto;
    }
  | {
      type: NewWsPollDataTypeEnum.NEW_POLL_VOTE;
      data: Omit<NewWsPollVoteDto, "vote">;
    };
