import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import { Notification, NotificationType, User } from "../../models";
import admin from "./firebaseAdmin";

interface CreateNotificationPayload {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, any>;
}

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
      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: {
          notificationId: notification._id.toString(),
          type,
          ...data,
        },
      });
    } catch (error: any) {
      // Log error but don't fail - notification is already saved
      console.error("Push notification failed:", error.message);
    }
  }

  return notification;
};

// Send notification to multiple users
const sendBulkNotification = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationType = NotificationType.NORMAL,
  data?: Record<string, any>
) => {
  if (!userIds.length) return { successCount: 0, failureCount: 0 };

  // Create notifications in bulk
  const notifications = await Notification.insertMany(
    userIds.map((userId) => ({ userId, title, body, type, data }))
  );

  // Get FCM tokens for all users
  const users = await User.find({ _id: { $in: userIds }, fcmToken: { $exists: true, $ne: null } })
    .select("_id fcmToken")
    .lean();

  if (!users.length) {
    return { successCount: notifications.length, failureCount: 0, pushSent: 0 };
  }

  // Send push notifications
  const tokens = users.map((u) => u.fcmToken!);
  
  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { type, ...data },
    });

    return {
      successCount: notifications.length,
      pushSent: response.successCount,
      pushFailed: response.failureCount,
    };
  } catch (error: any) {
    console.error("Bulk push notification failed:", error.message);
    return { successCount: notifications.length, pushSent: 0, pushFailed: tokens.length };
  }
};

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
    Notification.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(),
  ]);

  return {
    data: notifications,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Get single notification and mark as read
const getSingleNotification = async (userId: string, notificationId: string) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
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
  const result = await Notification.findOneAndDelete({ _id: notificationId, userId });
  
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
};
