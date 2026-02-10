import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { balanceController } from "./balance.controller";
import { AccountValidation } from "./balance.validation";

const router = express.Router();

// Create a new account
router.post(
  "/add-account",
  auth(),
  validateRequest(AccountValidation.CreateAccountSchema),
  balanceController.createAccount,
);

router.get("/total-account", auth(), balanceController.getTotalAccount);

router.put(
  "/:accountId",
  auth(),
  validateRequest(AccountValidation.UpdateAccountSchema),
  balanceController.updateAccount,
);

router.delete("/:accountId", auth(), balanceController.deleteAccount);

// Add income to account
router.post(
  "/income",
  auth(),
  validateRequest(AccountValidation.AddIncomeSchema),
  balanceController.addIncomeToAccount,
);

// Add spending to account
router.post(
  "/spending",
  auth(),
  validateRequest(AccountValidation.AddSpendingSchema),
  balanceController.addSpendingToAccount,
);

// Get daily income and spending summary
router.get("/daily-summary", auth(), balanceController.getIncomeSpendingByDate);

// Get monthly income and spending summary
router.get(
  "/monthly-summary",
  auth(),
  balanceController.getIncomeSpendingByMonth,
);

router.get("/current-balance", auth(), balanceController.getCurrentBalance);

export const BalanceRoutes = router;
