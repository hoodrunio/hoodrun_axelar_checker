export interface IParticipantsData {
  poll_id: string;
  participants: string[];
}
export class ParticipantsData implements IParticipantsData {
  constructor(public poll_id: string, public participants: string[]) {
    this.participants = participants;
    this.poll_id = poll_id;
  }
}
