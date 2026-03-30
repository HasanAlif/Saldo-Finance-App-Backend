import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { balanceController } from "./balance.controller";
import { AccountValidation } from "./balance.validation";

const router = express.Router();

router.post(
  "/add-account",
  auth(),
  validateRequest(AccountValidation.CreateAccountSchema),
  balanceController.createAccount,
);

router.get("/total-account", auth(), balanceController.getTotalAccount);

router.post(
  "/income",
  auth(),
  validateRequest(AccountValidation.AddIncomeSchema),
  balanceController.addIncomeToAccount,
);

router.post(
  "/spending",
  auth(),
  validateRequest(AccountValidation.AddSpendingSchema),
  balanceController.addSpendingToAccount,
);

router.get("/daily-summary", auth(), balanceController.getIncomeSpendingByDate);

router.get(
  "/range-summary",
  auth(),
  validateRequest(AccountValidation.DateRangeSchema),
  balanceController.getIncomeSpendingByDateRange,
);

router.get(
  "/monthly-summary",
  auth(),
  balanceController.getIncomeSpendingByMonth,
);

router.get("/current-balance", auth(), balanceController.getCurrentBalance);

router.get("/:accountId", auth(), balanceController.getAccountById);

router.put(
  "/:accountId",
  auth(),
  validateRequest(AccountValidation.UpdateAccountSchema),
  balanceController.updateAccount,
);

router.delete("/:accountId", auth(), balanceController.deleteAccount);

export const BalanceRoutes = router;
