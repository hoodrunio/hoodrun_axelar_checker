import { IWsSubscribeEventType } from "@/ws/interface/IWsSubscribeEvent";
import { BaseSendEvent } from "@/ws/event/BaseSendEvent";

export enum AmplifierEventType {
  POLL_STARTED = "wasm-messages_poll_started.poll_id",
  POLL_COMPLETED = "wasm-quorum_reached.poll_id",
  SIGNING_STARTED = "wasm-signing_started.session_id",
  SIGNING_COMPLETED = "wasm-signing_completed.session_id"
}

export class AmplifierSendEvent extends BaseSendEvent {
  constructor(
    private readonly eventType: AmplifierEventType,
    private readonly params?: Record<string, any>
  ) {
    super();
  }

  asWsSubscribeEvent(): IWsSubscribeEventType {
    const query = this.buildQuery();
    return {
      jsonrpc: "2.0",
      method: "subscribe",
      id: "0",
      params: { query }
    };
  }

  private buildQuery(): string {
    let query = `tm.event='Tx' AND ${this.eventType} EXISTS`;
    
    if (this.params) {
      Object.entries(this.params).forEach(([key, value]) => {
        query += ` AND ${this.eventType}.${key}='${value}'`;
      });
    }
    
    return query;
  }
}

// Active events for subscription management
export const ActiveAmplifierEvents = {
  PollStarted: new AmplifierSendEvent(AmplifierEventType.POLL_STARTED),
  PollCompleted: new AmplifierSendEvent(AmplifierEventType.POLL_COMPLETED),
  SigningStarted: new AmplifierSendEvent(AmplifierEventType.SIGNING_STARTED),
  SigningCompleted: new AmplifierSendEvent(AmplifierEventType.SIGNING_COMPLETED)
} as const; 