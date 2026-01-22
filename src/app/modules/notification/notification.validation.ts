import { z } from "zod";
import { NotificationType } from "../../models";

const sendNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required").max(1000),
  type: z.nativeEnum(NotificationType).optional(),
  data: z.record(z.any()).optional(),
});

const sendBulkNotificationSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required").max(1000),
  type: z.nativeEnum(NotificationType).optional(),
  data: z.record(z.any()).optional(),
});

export const NotificationValidation = {
  sendNotificationSchema,
  sendBulkNotificationSchema,
};
