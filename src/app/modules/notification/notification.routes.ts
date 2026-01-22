import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "../../models";
import { notificationController } from "./notification.controller";

const router = express.Router();

// Get my notifications
router.get("/me", auth(), notificationController.getMyNotifications);

// Get unread count
router.get("/unread-count", auth(), notificationController.getUnreadCount);

// Mark all as read
router.patch("/mark-all-read", auth(), notificationController.markAllAsRead);

// Get single notification (marks as read)
router.get("/:notificationId", auth(), notificationController.getSingleNotification);

// Delete notification
router.delete("/:notificationId", auth(), notificationController.deleteNotification);

// Admin: Get all notifications
router.get("/", auth(UserRole.ADMIN), notificationController.getAllNotifications);

export const notificationsRoute = router;
