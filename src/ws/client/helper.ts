import { MessageEvent } from "ws";
import { IWsEventData } from "ws/interface/IWsEventMessage";

const parseWsMessageEvent = (event: MessageEvent): string => {
  let data: string = "Unknown data type received from ws";

  switch (true) {
    case typeof event.data === "string":
      data = event.data;
      break;
    case event.data instanceof Buffer:
      data = event.data.toString();
      break;
    case event.data instanceof ArrayBuffer:
      data = new TextDecoder().decode(event.data);
      break;
    case Array.isArray(event.data) &&
      event.data.every((item) => item instanceof Buffer):
      data = event.data.map((buffer) => buffer.toString()).join("");
      break;
    default:
      console.error("Unexpected data type:", typeof event.data);
      return data;
  }

  return data;
};

export const parseAxlEventMessage = <T>(
  event: MessageEvent
): IWsEventData<T> | undefined => {
  try {
    const data = parseWsMessageEvent(event);
    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing ws message:", error);
    return undefined;
  }
};
