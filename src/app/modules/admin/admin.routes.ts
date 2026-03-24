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

export const adminRoutes = router;
