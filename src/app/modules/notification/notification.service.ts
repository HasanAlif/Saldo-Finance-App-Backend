import mongoose from "mongoose";
import httpStatus from "http-status";
import axios from "axios";
import ApiError from "../../../errors/ApiErrors";
import { Notification, NotificationType, User } from "../../models";
import { Budget } from "../budget/budget.model";
import { Spending } from "../balance/spending.model";
import admin, { getFirebaseInitError, isFirebaseReady } from "./firebaseAdmin";
import { fcmTokenService } from "../fcm-token/fcm-token.service";

interface CreateNotificationPayload {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, any>;
}

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-recipient",
]);
const MAX_FCM_MULTICAST_TOKENS = 500;
const MAX_EXPO_PUSH_BATCH_SIZE = 100;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BROADCAST_USER_BATCH_SIZE = Math.max(
  100,
  Number(process.env.NOTIFICATION_USER_BATCH_SIZE) || 2000,
);

interface BulkNotificationResult {
  successCount: number;
  pushSent: number;
  pushFailed: number;
  pushSkipped: number;
}

interface ProviderSendResult {
  success: number;
  failed: number;
  skipped: number;
  invalidTokens: Array<{ userId: string; token: string }>;
}

interface ClassifiedTokens {
  expoTokens: string[];
  fcmTokens: string[];
  unknownTokens: string[];
}

const createFcmData = (
  type: NotificationType,
  data?: Record<string, any>,
): Record<string, string> => {
  const fcmData: Record<string, string> = { type };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      fcmData[k] = String(v);
    }
  }
  return fcmData;
};

const isExpoToken = (token: string): boolean => {
  return (
    token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
  );
};

const isLikelyFcmToken = (token: string): boolean => {
  if (!token || typeof token !== "string") {
    return false;
  }

  const trimmed = token.trim();
  if (!trimmed || trimmed.includes(" ")) {
    return false;
  }

  return trimmed.includes(":") || trimmed.length >= 40;
};

const classifyTokens = (tokens: string[]): ClassifiedTokens => {
  const expoTokens: string[] = [];
  const fcmTokens: string[] = [];
  const unknownTokens: string[] = [];

  for (const token of tokens) {
    if (isExpoToken(token)) {
      expoTokens.push(token);
      continue;
    }

    if (isLikelyFcmToken(token)) {
      fcmTokens.push(token);
      continue;
    }

    unknownTokens.push(token);
  }

  return { expoTokens, fcmTokens, unknownTokens };
};

const normalizeExpoTickets = (payload: any): any[] => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload?.data) {
    return [payload.data];
  }

  return [];
};

const isExpoInvalidTokenError = (ticket: any): boolean => {
  const detailsError = String(ticket?.details?.error || "").toLowerCase();
  const message = String(ticket?.message || "").toLowerCase();

  return (
    detailsError.includes("devicenotregistered") ||
    message.includes("device not registered") ||
    message.includes("not registered") ||
    message.includes("invalid")
  );
};

const sendExpoNotifications = async (
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  tokenUserMap: Map<string, string>,
): Promise<ProviderSendResult> => {
  if (!tokens.length) {
    return { success: 0, failed: 0, skipped: 0, invalidTokens: [] };
  }

  let success = 0;
  let failed = 0;
  const invalidTokens: Array<{ userId: string; token: string }> = [];

  for (let i = 0; i < tokens.length; i += MAX_EXPO_PUSH_BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + MAX_EXPO_PUSH_BATCH_SIZE);

    try {
      const messages = batchTokens.map((token) => ({
        to: token,
        title,
        body,
        sound: "default",
        data,
      }));

      const expoRes = await axios.post(EXPO_PUSH_URL, messages, {
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
      });

      const tickets = normalizeExpoTickets(expoRes.data);

      batchTokens.forEach((token, idx) => {
        const ticket = tickets[idx];

        if (!ticket || ticket.status === "error") {
          failed += 1;

          if (isExpoInvalidTokenError(ticket)) {
            const userId = tokenUserMap.get(token);
            if (userId) {
              invalidTokens.push({ userId, token });
            }
          }

          return;
        }

        success += 1;
      });
    } catch (error: any) {
      failed += batchTokens.length;
      console.error(
        `[PUSH][EXPO] batch send failed: ${error.response?.data?.errors?.[0]?.message || error.message}`,
      );
    }
  }

  return { success, failed, skipped: 0, invalidTokens };
};

const sendFcmNotifications = async (
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  tokenUserMap: Map<string, string>,
): Promise<ProviderSendResult> => {
  if (!tokens.length) {
    return { success: 0, failed: 0, skipped: 0, invalidTokens: [] };
  }

  if (!isFirebaseReady()) {
    console.error(
      `[PUSH][FCM] skipped. Firebase not ready: ${getFirebaseInitError() ?? "unknown initialization error"}`,
    );
    return {
      success: 0,
      failed: 0,
      skipped: tokens.length,
      invalidTokens: [],
    };
  }

  let success = 0;
  let failed = 0;
  const invalidTokens: Array<{ userId: string; token: string }> = [];

  for (let i = 0; i < tokens.length; i += MAX_FCM_MULTICAST_TOKENS) {
    const batchTokens = tokens.slice(i, i + MAX_FCM_MULTICAST_TOKENS);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batchTokens,
        notification: { title, body },
        data,
      });

      success += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          INVALID_TOKEN_ERROR_CODES.has(res.error?.code || "")
        ) {
          const token = batchTokens[idx];
          const userId = tokenUserMap.get(token);

          if (userId) {
            invalidTokens.push({ userId, token });
          }
        }
      });
    } catch (error: any) {
      failed += batchTokens.length;
      console.error(`[PUSH][FCM] batch send failed: ${error.message}`);
    }
  }

  return { success, failed, skipped: 0, invalidTokens };
};

const sendBulkNotificationToTargetIds = async (
  targetIds: string[],
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>,
): Promise<BulkNotificationResult> => {
  const uniqueTargetIds = Array.from(new Set(targetIds));

  if (!uniqueTargetIds.length) {
    return { successCount: 0, pushSent: 0, pushFailed: 0, pushSkipped: 0 };
  }

  const notifications = await Notification.insertMany(
    uniqueTargetIds.map((userId) => ({ userId, title, body, type, data })),
  );

  const users = await User.find({
    _id: { $in: uniqueTargetIds },
    fcmTokens: { $exists: true, $not: { $size: 0 } },
  })
    .select("+fcmTokens _id")
    .lean();

  const noTokenUserCount = Math.max(0, uniqueTargetIds.length - users.length);

  if (!users.length) {
    console.warn(
      `[FCM] Bulk push skipped. ${uniqueTargetIds.length} target user(s) have no registered tokens.`,
    );
    return {
      successCount: notifications.length,
      pushSent: 0,
      pushFailed: 0,
      pushSkipped: uniqueTargetIds.length,
    };
  }

  const tokenUserMap: Map<string, string> = new Map();
  const allTokens: string[] = [];

  users.forEach((user) => {
    (user.fcmTokens || []).forEach((t) => {
      if (!tokenUserMap.has(t.token)) {
        tokenUserMap.set(t.token, user._id.toString());
        allTokens.push(t.token);
      }
    });
  });

  if (!allTokens.length) {
    return {
      successCount: notifications.length,
      pushSent: 0,
      pushFailed: 0,
      pushSkipped: uniqueTargetIds.length,
    };
  }

  const { expoTokens, fcmTokens, unknownTokens } = classifyTokens(allTokens);
  const fcmData = createFcmData(type, data);

  const expoResult = await sendExpoNotifications(
    expoTokens,
    title,
    body,
    fcmData,
    tokenUserMap,
  );

  const fcmResult = await sendFcmNotifications(
    fcmTokens,
    title,
    body,
    fcmData,
    tokenUserMap,
  );

  const invalidTokensToRemove = [
    ...expoResult.invalidTokens,
    ...fcmResult.invalidTokens,
  ];

  if (invalidTokensToRemove.length) {
    const dedupedInvalidTokens = Array.from(
      new Map(
        invalidTokensToRemove.map((item) => [
          `${item.userId}:${item.token}`,
          item,
        ]),
      ).values(),
    );

    await fcmTokenService.removeInvalidTokensBulk(dedupedInvalidTokens);
    console.log(
      `[PUSH] Removed ${dedupedInvalidTokens.length} invalid token(s) from bulk send`,
    );
  }

  if (unknownTokens.length) {
    console.warn(
      `[PUSH] Bulk send skipped ${unknownTokens.length} token(s) with unknown format`,
    );
  }

  const pushSent = expoResult.success + fcmResult.success;
  const pushFailed = expoResult.failed + fcmResult.failed;
  const pushSkipped =
    noTokenUserCount + unknownTokens.length + fcmResult.skipped;

  console.log(
    `[PUSH] Bulk send summary -> users:${uniqueTargetIds.length}, expo:${expoTokens.length}, fcm:${fcmTokens.length}, sent:${pushSent}, failed:${pushFailed}, skipped:${pushSkipped}`,
  );

  return {
    successCount: notifications.length,
    pushSent,
    pushFailed,
    pushSkipped,
  };
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getMonthDateRange = (
  monthStartDate: number = 1,
): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentDay = now.getDate();

  let startDate: Date;
  let endDate: Date;

  if (currentDay >= monthStartDate) {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      monthStartDate,
      0,
      0,
      0,
      0,
    );
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      monthStartDate - 1,
      23,
      59,
      59,
      999,
    );
  } else {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      monthStartDate,
      0,
      0,
      0,
      0,
    );
    endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      monthStartDate - 1,
      23,
      59,
      59,
      999,
    );
  }

  return { startDate, endDate };
};

const getWeekDateRange = (
  monthStartDate: number = 1,
): { startDate: Date; endDate: Date } => {
  const { startDate: cycleStart, endDate: cycleEnd } =
    getMonthDateRange(monthStartDate);
  const now = new Date();

  const daysSinceCycleStart = Math.floor(
    (now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNumber = Math.max(0, Math.floor(daysSinceCycleStart / 7));

  const startDate = new Date(cycleStart);
  startDate.setDate(cycleStart.getDate() + weekNumber * 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  if (endDate > cycleEnd) {
    endDate.setTime(cycleEnd.getTime());
  }

  return { startDate, endDate };
};

const sendNotification = async (payload: CreateNotificationPayload) => {
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
    const tokenUserMap: Map<string, string> = new Map();
    const tokens = Array.from(
      new Set(user.fcmTokens.map((t) => t.token.trim())),
    );

    tokens.forEach((token) => {
      tokenUserMap.set(token, userId);
    });

    const { expoTokens, fcmTokens, unknownTokens } = classifyTokens(tokens);

    const fcmData: Record<string, string> = {
      notificationId: notification._id.toString(),
      type,
    };
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        fcmData[k] = String(v);
      }
    }

    const expoResult = await sendExpoNotifications(
      expoTokens,
      title,
      body,
      fcmData,
      tokenUserMap,
    );

    const fcmResult = await sendFcmNotifications(
      fcmTokens,
      title,
      body,
      fcmData,
      tokenUserMap,
    );

    const invalidTokensToRemove = [
      ...expoResult.invalidTokens,
      ...fcmResult.invalidTokens,
    ];

    if (invalidTokensToRemove.length) {
      const dedupedInvalidTokens = Array.from(
        new Map(
          invalidTokensToRemove.map((item) => [
            `${item.userId}:${item.token}`,
            item,
          ]),
        ).values(),
      );

      await fcmTokenService.removeInvalidTokensBulk(dedupedInvalidTokens);
      console.log(
        `[PUSH] Removed ${dedupedInvalidTokens.length} invalid token(s) for user ${userId}`,
      );
    }

    if (unknownTokens.length) {
      console.warn(
        `[PUSH] User ${userId} has ${unknownTokens.length} token(s) with unknown format`,
      );
    }

    console.log(
      `[PUSH] User ${userId} push summary -> expo:${expoTokens.length}, fcm:${fcmTokens.length}, sent:${expoResult.success + fcmResult.success}, failed:${expoResult.failed + fcmResult.failed}, skipped:${unknownTokens.length + fcmResult.skipped}`,
    );
  } else {
    console.warn(
      `[FCM] Push skipped for user ${userId}. No registered tokens.`,
    );
  }

  return notification;
};

const sendBulkNotification = async (
  userIds: string[] | null,
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>,
) => {
  if (userIds && userIds.length > 0) {
    return sendBulkNotificationToTargetIds(userIds, title, body, type, data);
  }

  let lastId: string | null = null;
  let totalResult: BulkNotificationResult = {
    successCount: 0,
    pushSent: 0,
    pushFailed: 0,
    pushSkipped: 0,
  };

  while (true) {
    const query: Record<string, any> = { status: "ACTIVE" };
    if (lastId) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
    }

    const userBatch = await User.find(query)
      .select("_id")
      .sort({ _id: 1 })
      .limit(BROADCAST_USER_BATCH_SIZE)
      .lean();

    if (!userBatch.length) {
      break;
    }

    const batchIds = userBatch.map((u) => u._id.toString());

    try {
      const batchResult = await sendBulkNotificationToTargetIds(
        batchIds,
        title,
        body,
        type,
        data,
      );
      totalResult = {
        successCount: totalResult.successCount + batchResult.successCount,
        pushSent: totalResult.pushSent + batchResult.pushSent,
        pushFailed: totalResult.pushFailed + batchResult.pushFailed,
        pushSkipped: totalResult.pushSkipped + batchResult.pushSkipped,
      };
    } catch (error: any) {
      console.error(
        `[FCM] Broadcast batch failed for ${batchIds.length} user(s): ${error.message}`,
      );
      totalResult.pushFailed += batchIds.length;
    }

    lastId = userBatch[userBatch.length - 1]._id.toString();
  }

  return totalResult;
};

const checkBudgetAlerts = async (userId: string, spendingCategory: string) => {
  try {
    const budgets = await Budget.find({
      userId: new mongoose.Types.ObjectId(userId),
      category: {
        $regex: new RegExp(`^${escapeRegex(spendingCategory)}$`, "i"),
      },
    }).lean();

    if (!budgets.length) return;

    const user = await User.findById(userId).select("monthStartDate").lean();
    const monthStartDate = user?.monthStartDate || 1;

    for (const budget of budgets) {
      const { startDate, endDate } =
        budget.status === "MONTHLY"
          ? getMonthDateRange(monthStartDate)
          : getWeekDateRange(monthStartDate);

      const spendingAgg = await Spending.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            category: {
              $regex: new RegExp(`^${escapeRegex(budget.category)}$`, "i"),
            },
            date: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const totalSpent = spendingAgg[0]?.total || 0;
      if (budget.budgetValue <= 0) continue;

      const percentage = (totalSpent / budget.budgetValue) * 100;
      const periodStartStr = startDate.toISOString().split("T")[0];

      let currentThresholds: number[] = budget.notifiedThresholds || [];
      const storedPeriod = budget.thresholdPeriodStart
        ? new Date(budget.thresholdPeriodStart).toISOString().split("T")[0]
        : null;

      if (storedPeriod !== periodStartStr) {
        await Budget.updateOne(
          { _id: budget._id },
          { notifiedThresholds: [], thresholdPeriodStart: startDate },
        );
        currentThresholds = [];
      }

      const periodLabel = budget.status === "MONTHLY" ? "month" : "week";

      for (const threshold of [50, 80, 100]) {
        if (percentage >= threshold && !currentThresholds.includes(threshold)) {
          const isExceeded = threshold >= 100;

          await sendNotification({
            userId,
            title: isExceeded ? "Budget Exceeded" : "Budget Alert",
            body: isExceeded
              ? `You have used full budget of your ${budget.category} budget for this ${periodLabel}.`
              : `You have used ${threshold}% of your ${budget.category} budget for this ${periodLabel}.`,
            type: NotificationType.URGENT,
            data: {
              notifType: "BUDGET_ALERT",
              budgetId: budget._id.toString(),
              threshold: threshold.toString(),
              periodStart: periodStartStr,
              category: budget.category,
            },
          });

          await Budget.updateOne(
            { _id: budget._id },
            { $addToSet: { notifiedThresholds: threshold } },
          );
        }
      }
    }
  } catch (error: any) {
    console.error("Budget alert check error:", error.message);
  }
};

const sendTransactionNotification = async (
  userId: string,
  transactionType: "income" | "spending",
  category: string,
  amount: number,
  currency: string,
) => {
  try {
    const body =
      transactionType === "income"
        ? `In ${category} you have earned ${amount}${currency} and this has been recorded.`
        : `In ${category} you have spended ${amount}${currency} and this has been recorded.`;

    await sendNotification({
      userId,
      title: "Transaction Added",
      body,
      type: NotificationType.NORMAL,
      data: {
        notifType: "TRANSACTION",
        transactionType,
        category,
        amount: amount.toString(),
        currency,
      },
    });
  } catch (error: any) {
    console.error("Transaction notification error:", error.message);
  }
};

const getMyNotifications = async (userId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    data: notifications,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    },
  };
};

const getAllNotifications = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(),
  ]);

  return {
    data: notifications,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getSingleNotification = async (
  userId: string,
  notificationId: string,
) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true },
  ).lean();

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return notification;
};

const markAllAsRead = async (userId: string) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return { message: "All notifications marked as read" };
};

const deleteNotification = async (userId: string, notificationId: string) => {
  const result = await Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return { message: "Notification deleted" };
};

const getUnreadCount = async (userId: string) => {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return { unreadCount: count };
};

export const notificationServices = {
  sendNotification,
  sendBulkNotification,
  getMyNotifications,
  getAllNotifications,
  getSingleNotification,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  checkBudgetAlerts,
  sendTransactionNotification,
};
