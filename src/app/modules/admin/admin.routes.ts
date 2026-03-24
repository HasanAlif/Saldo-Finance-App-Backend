import express from "express";
import auth from "../../middlewares/auth";
import { adminController } from "./admin.controller";
import { UserRole } from "../../models";

const router = express.Router();

router.get("/users-count", auth(UserRole.ADMIN), adminController.getUsersCount);
router.get(
  "/monthly-user-growth",
  auth(UserRole.ADMIN),
  adminController.getMonthlyUserGrowth,
);
router.get(
  "/monthly-premium-users-growth",
  auth(UserRole.ADMIN),
  adminController.getMonthlyPremiumUsersGrowth,
);
router.get(
  "/recent-users",
  auth(UserRole.ADMIN),
  adminController.getRecentUsers,
);

export const adminRoutes = router;
