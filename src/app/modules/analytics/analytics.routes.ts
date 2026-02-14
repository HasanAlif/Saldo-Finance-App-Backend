import express from "express";
import auth from "../../middlewares/auth";
import { analyticsController } from "./analytics.controller";

const router = express.Router();

router.get(
  "/income-vs-expenses",
  auth(),
  analyticsController.getIncomeVsExpenses,
);

router.get("/balance-trend", auth(), analyticsController.getBalanceTrend);

router.get(
  "/spending-by-category",
  auth(),
  analyticsController.getSpendingByCategory,
);

export const analyticsRoutes = router;
