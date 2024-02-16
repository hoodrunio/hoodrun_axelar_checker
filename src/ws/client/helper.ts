import { Data } from "ws";
import { IWsEventData } from "ws/interface/IWsEventMessage";

export const parseWsMessageEventData = (messageData: Data): string => {
  let data: string = "Unknown data type received from ws";
  switch (true) {
    case typeof messageData === "string":
      data = messageData;
      break;
    case messageData instanceof Buffer:
      data = messageData.toString();
      break;
    case messageData instanceof ArrayBuffer:
      data = new TextDecoder().decode(messageData);
      break;
    case Array.isArray(messageData) &&
      messageData.every((item) => item instanceof Buffer):
      data = messageData.map((buffer) => buffer.toString()).join("");
      break;
    default:
      console.error("Unexpected data type:", typeof messageData);
      return data;
  }

  return data;
};

export const parseAxlEventMessageData = <T>(
  messageData: Data
): IWsEventData<T> | undefined => {
  try {
    const data = parseWsMessageEventData(messageData);
    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing ws message:", error);
    return undefined;
  }
};
