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
  data?: Record<string, any>,
): Promise<string | null> => {
  try {
    const response = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    });
    return response;
  } catch (error: any) {
    console.error("Push notification error:", error.message);
    return null;
  }
};

// Create notification and send push (to all user's devices)
export const createAndSendNotification = async (
  payload: NotificationPayload,
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

  // Get user FCM tokens and send push to all devices
  const user = await User.findById(userId).select("+fcmTokens").lean();

  if (user?.fcmTokens?.length) {
    const tokens = user.fcmTokens.map((t) => t.token);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          notificationId: notification._id.toString(),
          type,
          ...(data
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)]),
              )
            : {}),
        },
      });

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const errorCode = res.error?.code;
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });
        if (invalidTokens.length) {
          await User.updateOne(
            { _id: userId },
            { $pull: { fcmTokens: { token: { $in: invalidTokens } } } },
          );
        }
      }
    } catch (error: any) {
      console.error("Push notification error:", error.message);
    }
  }
};

// Send notification to multiple users (all their devices)
export const sendBulkPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>,
): Promise<{ sent: number; failed: number }> => {
  if (!userIds.length) return { sent: 0, failed: 0 };

  // Get all user FCM tokens
  const users = await User.find({
    _id: { $in: userIds },
    fcmTokens: { $exists: true, $not: { $size: 0 } },
  })
    .select("+fcmTokens _id")
    .lean();

  if (!users.length) return { sent: 0, failed: 0 };

  // Flatten all tokens with user mapping
  const tokenUserMap: Map<string, string> = new Map();
  const allTokens: string[] = [];

  users.forEach((user) => {
    (user.fcmTokens || []).forEach((t) => {
      tokenUserMap.set(t.token, user._id.toString());
      allTokens.push(t.token);
    });
  });

  if (!allTokens.length) return { sent: 0, failed: 0 };

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      notification: { title, body },
      data: data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    });

    if (response.failureCount > 0) {
      const invalidTokensToRemove: Array<{ userId: string; token: string }> =
        [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            const token = allTokens[idx];
            const userId = tokenUserMap.get(token);
            if (userId) {
              invalidTokensToRemove.push({ userId, token });
            }
          }
        }
      });

      if (invalidTokensToRemove.length) {
        const bulkOps = invalidTokensToRemove.map(({ userId, token }) => ({
          updateOne: {
            filter: { _id: userId },
            update: { $pull: { fcmTokens: { token } } },
          },
        }));
        await User.bulkWrite(bulkOps);
      }
    }

    return {
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error: any) {
    console.error("Bulk push error:", error.message);
    return { sent: 0, failed: allTokens.length };
  }
};
