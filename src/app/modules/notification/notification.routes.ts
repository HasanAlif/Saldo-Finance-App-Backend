import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { UserRole } from "../../models";
import { notificationController } from "./notification.controller";
import { NotificationValidation } from "./notification.validation";

const router = express.Router();

// User routes
router.get("/me", auth(), notificationController.getMyNotifications);
router.get("/unread-count", auth(), notificationController.getUnreadCount);
router.patch("/mark-all-read", auth(), notificationController.markAllAsRead);
router.get(
  "/:notificationId",
  auth(),
  notificationController.getSingleNotification,
);
router.delete(
  "/:notificationId",
  auth(),
  notificationController.deleteNotification,
);

// Admin routes
router.get(
  "/",
  auth(UserRole.ADMIN),
  notificationController.getAllNotifications,
);

router.post(
  "/send",
  auth(UserRole.ADMIN),
  validateRequest(NotificationValidation.sendNotificationSchema),
  notificationController.sendNotification,
);

router.post(
  "/send-bulk",
  auth(UserRole.ADMIN),
  validateRequest(NotificationValidation.sendBulkNotificationSchema),
  notificationController.sendBulkNotification,
);

export const notificationsRoute = router;
