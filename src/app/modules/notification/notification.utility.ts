import { NotificationType, User, Notification } from "../../models";
import admin from "./firebaseAdmin";
import axios from "axios";

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, any>;
}

export const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<string | null> => {
  try {
    const stringifiedData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : undefined;

    if (
      fcmToken.startsWith("ExponentPushToken[") ||
      fcmToken.startsWith("ExpoPushToken[")
    ) {
      const response = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        {
          to: fcmToken,
          title,
          body,
          sound: "default",
          data: stringifiedData,
          _displayInForeground: true,
        },
        {
          headers: {
            Accept: "application/json",
            "Accept-encoding": "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      console.log("Single Expo Push Response:", response.data);
      return response.data?.data?.id || "expo-sent";
    }

    const response = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringifiedData,
    });
    return response;
  } catch (error: any) {
    console.error("Push notification error:", error.message);
    return null;
  }
};

export const createAndSendNotification = async (
  payload: NotificationPayload,
): Promise<void> => {
  const { userId, title, body, type = NotificationType.NORMAL, data } = payload;

  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
    data,
  });

  const user = await User.findById(userId).select("+fcmTokens").lean();

  if (user?.fcmTokens?.length) {
    const expoTokens = user.fcmTokens
      .map((t) => t.token)
      .filter(
        (t) =>
          t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["),
      );
    const fcmTokens = user.fcmTokens
      .map((t) => t.token)
      .filter(
        (t) =>
          !t.startsWith("ExponentPushToken[") &&
          !t.startsWith("ExpoPushToken["),
      );

    const stringifiedData = {
      notificationId: notification._id.toString(),
      type,
      ...(data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)]),
          )
        : {}),
    };

    if (expoTokens.length > 0) {
      try {
        const messages = expoTokens.map((token) => ({
          to: token,
          sound: "default",
          title,
          body,
          data: stringifiedData,
          _displayInForeground: true,
        }));
        const expoRes = await axios.post(
          "https://exp.host/--/api/v2/push/send",
          messages,
          {
            headers: {
              Accept: "application/json",
              "Accept-encoding": "application/json",
              "Content-Type": "application/json",
            },
          },
        );
        console.log("Expo Push Response:", expoRes.data);
      } catch (error: any) {
        console.error(
          "Expo push notification error:",
          error.response?.data || error.message,
        );
      }
    }

    if (fcmTokens.length > 0) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: { title, body },
          data: stringifiedData,
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
                invalidTokens.push(fcmTokens[idx]);
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
        console.error("Firebase push notification error:", error.message);
      }
    }
  }
};

export const sendBulkPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>,
): Promise<{ sent: number; failed: number }> => {
  if (!userIds.length) return { sent: 0, failed: 0 };

  const users = await User.find({
    _id: { $in: userIds },
    fcmTokens: { $exists: true, $not: { $size: 0 } },
  })
    .select("+fcmTokens _id")
    .lean();

  if (!users.length) return { sent: 0, failed: 0 };

  const tokenUserMap: Map<string, string> = new Map();
  const expoTokens: string[] = [];
  const fcmTokens: string[] = [];

  users.forEach((user) => {
    (user.fcmTokens || []).forEach((t) => {
      tokenUserMap.set(t.token, user._id.toString());
      if (
        t.token.startsWith("ExponentPushToken[") ||
        t.token.startsWith("ExpoPushToken[")
      ) {
        expoTokens.push(t.token);
      } else {
        fcmTokens.push(t.token);
      }
    });
  });

  if (!expoTokens.length && !fcmTokens.length) return { sent: 0, failed: 0 };

  const stringifiedData = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : undefined;

  let sent = 0;
  let failed = 0;

  if (expoTokens.length > 0) {
    try {
      const messages = expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title,
        body,
        data: stringifiedData,
        _displayInForeground: true,
      }));
      const expoRes = await axios.post(
        "https://exp.host/--/api/v2/push/send",
        messages,
        {
          headers: {
            Accept: "application/json",
            "Accept-encoding": "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      console.log("Bulk Expo Push Response:", expoRes.data);
      sent += expoTokens.length;
    } catch (error: any) {
      console.error(
        "Bulk Expo push error:",
        error.response?.data || error.message,
      );
      failed += expoTokens.length;
    }
  }

  if (fcmTokens.length > 0) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data: stringifiedData,
      });

      sent += response.successCount;
      failed += response.failureCount;

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
              const token = fcmTokens[idx];
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
    } catch (error: any) {
      console.error("Bulk Firebase push error:", error.message);
      failed += fcmTokens.length;
    }
  }

  return { sent, failed };
};
