import mongoose from "mongoose";
import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import { Notification, NotificationType, User } from "../../models";
import { Budget } from "../budget/budget.model";
import { Spending } from "../balance/spending.model";
import admin from "./firebaseAdmin";

interface CreateNotificationPayload {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, any>;
}

// Escape regex special characters in user-provided strings
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Helper: Get custom month date range based on user's start date
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

// Helper: Get custom week date range
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

// ==========================================
// Core notification functions
// ==========================================

// Create and send notification to a single user
const sendNotification = async (payload: CreateNotificationPayload) => {
  const { userId, title, body, type = NotificationType.NORMAL, data } = payload;

  // Save notification to database
  const notification = await Notification.create({
    userId,
    title,
    body,
    type,
    data,
  });

  // Get user's FCM token
  const user = await User.findById(userId).select("fcmToken").lean();

  // Send push notification if user has FCM token
  if (user?.fcmToken) {
    try {
      // Ensure all data values are strings for FCM
      const fcmData: Record<string, string> = {
        notificationId: notification._id.toString(),
        type,
      };
      if (data) {
        for (const [k, v] of Object.entries(data)) {
          fcmData[k] = String(v);
        }
      }

      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: fcmData,
      });
    } catch (error: any) {
      console.error("Push notification failed:", error.message);
    }
  }

  return notification;
};

// Send notification to multiple users (pass null to send to ALL active users)
const sendBulkNotification = async (
  userIds: string[] | null,
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>,
) => {
  let targetIds = userIds;

  // null or empty array means broadcast to every active user
  if (!targetIds || targetIds.length === 0) {
    const allUsers = await User.find({ status: "ACTIVE" }).select("_id").lean();
    targetIds = allUsers.map((u) => u._id.toString());
  }

  if (!targetIds.length) return { successCount: 0, failureCount: 0 };

  // Create notifications in bulk
  const notifications = await Notification.insertMany(
    targetIds.map((userId) => ({ userId, title, body, type, data })),
  );

  // Get FCM tokens for all users
  const users = await User.find({
    _id: { $in: targetIds },
    fcmToken: { $exists: true, $ne: null },
  })
    .select("_id fcmToken")
    .lean();

  if (!users.length) {
    return { successCount: notifications.length, failureCount: 0, pushSent: 0 };
  }

  // Ensure all data values are strings for FCM
  const fcmData: Record<string, string> = { type };
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      fcmData[k] = String(v);
    }
  }

  const tokens = users.map((u) => u.fcmToken!);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: fcmData,
    });

    return {
      successCount: notifications.length,
      pushSent: response.successCount,
      pushFailed: response.failureCount,
    };
  } catch (error: any) {
    console.error("Bulk push notification failed:", error.message);
    return {
      successCount: notifications.length,
      pushSent: 0,
      pushFailed: tokens.length,
    };
  }
};

// ==========================================
// Budget alert check (called after spending)
// ==========================================

const checkBudgetAlerts = async (userId: string, spendingCategory: string) => {
  try {
    // Find budgets matching the spending category (case-insensitive)
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

      // Aggregate total spending for this category in the current period
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

      // Reset thresholds if the period has changed
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

      // Check each threshold level
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

// ==========================================
// Transaction notification (called after income/spending)
// ==========================================

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

// ==========================================
// CRUD operations
// ==========================================

// Get notifications for a user
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

// Get all notifications (Admin)
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

// Get single notification and mark as read
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

// Mark all notifications as read
const markAllAsRead = async (userId: string) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return { message: "All notifications marked as read" };
};

// Delete notification
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

// Get unread count
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
