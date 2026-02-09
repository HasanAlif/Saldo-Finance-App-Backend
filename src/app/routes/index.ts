import express from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { BalanceRoutes } from "../modules/balance/balance.routes";
import { budgetRoutes } from "../modules/budget/budget.routes";
import { notificationsRoute } from "../modules/notification/notification.routes";
import { userRoutes } from "../modules/user/user.route";
import { profileRoutes } from "../modules/profile/profile.routes";
import { goalsRoutes } from "../modules/goals/goals.routes";
import { borrowedRoutes } from "../modules/borrowed/borrowed.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/notifications",
    route: notificationsRoute,
  },
  {
    path: "/balances",
    route: BalanceRoutes,
  },
  {
    path: "/budgets",
    route: budgetRoutes,
  },
  {
    path: "/profile",
    route: profileRoutes,
  },
  {
    path: "/goals",
    route: goalsRoutes,
  },
  {
    path: "/borrowed",
    route: borrowedRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
