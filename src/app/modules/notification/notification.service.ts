import mongoose from "mongoose";
import httpStatus from "http-status";
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
]);
const MAX_FCM_MULTICAST_TOKENS = 500;
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

  if (!isFirebaseReady()) {
    console.error(
      `[FCM] Bulk push skipped. Firebase not ready: ${getFirebaseInitError() ?? "unknown initialization error"}`,
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

  const fcmData = createFcmData(type, data);

  try {
    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokensToRemove: Array<{ userId: string; token: string }> = [];

    for (let i = 0; i < allTokens.length; i += MAX_FCM_MULTICAST_TOKENS) {
      const batchTokens = allTokens.slice(i, i + MAX_FCM_MULTICAST_TOKENS);

      const response = await admin.messaging().sendEachForMulticast({
        tokens: batchTokens,
        notification: { title, body },
        data: fcmData,
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          INVALID_TOKEN_ERROR_CODES.has(res.error?.code || "")
        ) {
          const token = batchTokens[idx];
          const userId = tokenUserMap.get(token);
          if (userId) {
            invalidTokensToRemove.push({ userId, token });
          }
        }
      });
    }

    if (invalidTokensToRemove.length) {
      await fcmTokenService.removeInvalidTokensBulk(invalidTokensToRemove);
      console.log(
        `[FCM] Removed ${invalidTokensToRemove.length} invalid token(s) from bulk send`,
      );
    }

    return {
      successCount: notifications.length,
      pushSent: totalSuccess,
      pushFailed: totalFailure,
      pushSkipped: noTokenUserCount,
    };
  } catch (error: any) {
    console.error("Bulk push notification failed:", error.message);
    return {
      successCount: notifications.length,
      pushSent: 0,
      pushFailed: allTokens.length,
      pushSkipped: noTokenUserCount,
    };
  }
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
    if (!isFirebaseReady()) {
      console.error(
        `[FCM] Push skipped for user ${userId}. Firebase not ready: ${getFirebaseInitError() ?? "unknown initialization error"}`,
      );
      return notification;
    }

    const tokens = Array.from(new Set(user.fcmTokens.map((t) => t.token)));

    const fcmData: Record<string, string> = {
      notificationId: notification._id.toString(),
      type,
    };
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        fcmData[k] = String(v);
      }
    }

    try {
      const invalidTokens: string[] = [];

      for (let i = 0; i < tokens.length; i += MAX_FCM_MULTICAST_TOKENS) {
        const batchTokens = tokens.slice(i, i + MAX_FCM_MULTICAST_TOKENS);
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batchTokens,
          notification: { title, body },
          data: fcmData,
        });

        if (response.failureCount > 0) {
          response.responses.forEach((res, idx) => {
            if (
              !res.success &&
              INVALID_TOKEN_ERROR_CODES.has(res.error?.code || "")
            ) {
              invalidTokens.push(batchTokens[idx]);
            }
          });
        }
      }

      if (invalidTokens.length) {
        await fcmTokenService.removeInvalidTokensBulk(
          invalidTokens.map((token) => ({ userId, token })),
        );
        console.log(
          `[FCM] Removed ${invalidTokens.length} invalid token(s) for user ${userId}`,
        );
      }
    } catch (error: any) {
      console.error(
        `[FCM] Push notification failed for user ${userId}: ${error.message}`,
      );
    }
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
