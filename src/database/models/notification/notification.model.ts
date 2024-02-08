import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";
import {
  INotificationDocument,
  NotificationEvent,
  NotificationType,
} from "./notification.interface";

const NOTIFICATION_COLLECTION_NAME = "notifications";

const NotificationSchema: Schema<INotificationDocument> =
  createAppSchema<INotificationDocument>({
    notification_id: { type: String, required: true, unique: true },
    event: {
      type: String,
      enum: Object.values(NotificationEvent),
      required: true,
    },
    data: { type: Schema.Types.Mixed, required: true },
    condition: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    }, // 'telegram', 'email', etc.
    recipient: { type: String, required: true }, // chat ID, email address, etc.
    sent: { type: Boolean, default: false },
  });

NotificationSchema.statics.buildModel = (args: INotificationDocument) => {
  return new NotificationDbModel(args);
};

const NotificationDbModel = model<INotificationDocument>(
  NOTIFICATION_COLLECTION_NAME,
  NotificationSchema
);

export default NotificationDbModel;
