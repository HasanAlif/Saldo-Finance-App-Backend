import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { NotificationType } from "../../models";
import { notificationServices } from "./notification.service";

// Get my notifications
const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await notificationServices.getMyNotifications(
    req.user.id,
    page,
    limit,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

// Get all notifications (Admin)
const getAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const result = await notificationServices.getAllNotifications(page, limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

// Get single notification
const getSingleNotification = catchAsync(
  async (req: Request, res: Response) => {
    const result = await notificationServices.getSingleNotification(
      req.user.id,
      req.params.notificationId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notification retrieved successfully",
      data: result,
    });
  },
);

// Mark all as read
const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.markAllAsRead(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});

// Delete notification
const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.deleteNotification(
    req.user.id,
    req.params.notificationId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

// Get unread count
const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationServices.getUnreadCount(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved",
    data: result,
  });
});

// Admin: Send notification to a single user
const sendNotification = catchAsync(async (req: Request, res: Response) => {
  const { userId, title, body, type, data } = req.body;

  const result = await notificationServices.sendNotification({
    userId,
    title,
    body,
    type: type || NotificationType.NORMAL,
    data,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Notification sent successfully",
    data: result,
  });
});

// Admin: Send notification to multiple users (omit userId to broadcast to ALL users)
const sendBulkNotification = catchAsync(async (req: Request, res: Response) => {
  const { userId, title, body, type, data } = req.body;

  const result = await notificationServices.sendBulkNotification(
    userId || null, // null triggers broadcast to all active users
    title,
    body,
    type || NotificationType.NORMAL,
    data,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Bulk notification sent successfully",
    data: result,
  });
});

export const notificationController = {
  getMyNotifications,
  getAllNotifications,
  getSingleNotification,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendNotification,
  sendBulkNotification,
};
