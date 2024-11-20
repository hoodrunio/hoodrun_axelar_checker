import { IWsSubscribeEventType } from "@/ws/interface/IWsSubscribeEvent";

export abstract class BaseSendEvent {
  abstract asWsSubscribeEvent(): IWsSubscribeEventType;

  asWsSubscribeEventString(): string {
    return JSON.stringify(this.asWsSubscribeEvent());
  }
} 