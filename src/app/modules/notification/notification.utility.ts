import { NotificationType, User, Notification } from "../../models";
import admin from "./firebaseAdmin";

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, any>;
}

// Send push notification via FCM
export const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string | null> => {
  try {
    const response = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : undefined,
    });
    return response;
  } catch (error: any) {
    console.error("Push notification error:", error.message);
    return null;
  }
};

// Create notification and send push
export const createAndSendNotification = async (
  payload: NotificationPayload
): Promise<void> => {
  const { userId, title, body, type = NotificationType.NORMAL, data } = payload;

  // Create notification in database
  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
    data,
  });

  // Get user FCM token and send push
  const user = await User.findById(userId).select("fcmToken").lean();
  
  if (user?.fcmToken) {
    await sendPushNotification(user.fcmToken, title, body, {
      notificationId: notification._id.toString(),
      type,
      ...data,
    });
  }
};

// Send notification to multiple users
export const sendBulkPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number }> => {
  if (!userIds.length) return { sent: 0, failed: 0 };

  // Get all user FCM tokens
  const users = await User.find({
    _id: { $in: userIds },
    fcmToken: { $exists: true, $ne: null },
  }).select("fcmToken").lean();

  if (!users.length) return { sent: 0, failed: 0 };

  const tokens = users.map((u) => u.fcmToken!);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : undefined,
    });

    return {
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error: any) {
    console.error("Bulk push error:", error.message);
    return { sent: 0, failed: tokens.length };
  }
};
