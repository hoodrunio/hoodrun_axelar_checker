import {
  INotificationDocument,
  NotificationEvent,
  NotificationType,
} from "@/database/models/notification/notification.interface";
import { createAppSchema } from "@database/helper";
import { model, Schema } from "mongoose";

const NOTIFICATION_COLLECTION_NAME = "notifications";

const NotificationSchema: Schema<INotificationDocument> =
  createAppSchema<INotificationDocument>({
    notification_id: { type: String, required: true, unique: true },
    event: {
      type: String,
      enum: Object.values(NotificationEvent),
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
      get: (data: any) => {
        if (data && typeof data === 'object' && 'currentUptime' in data) {
          const uptimeValue = typeof data.currentUptime === 'object' && data.currentUptime.toString ? 
            parseFloat(data.currentUptime.toString()) : 
            Number(data.currentUptime);
            
          return {
            ...data,
            currentUptime: uptimeValue
          };
        }
        return data;
      }
    },
    condition: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    }, // 'telegram', 'email', etc.
    recipient: { type: String, required: true }, // chat ID, email address, etc.
    sent: { type: Boolean, default: false },
    retryCount: { type: Number, default: 0 },
    failed: { type: Boolean, default: false },
    lastError: { type: String },
  });

NotificationSchema.statics.buildModel = (args: INotificationDocument) => {
  return new NotificationDbModel(args);
};

const NotificationDbModel = model<INotificationDocument>(
  NOTIFICATION_COLLECTION_NAME,
  NotificationSchema
);

export default NotificationDbModel;
