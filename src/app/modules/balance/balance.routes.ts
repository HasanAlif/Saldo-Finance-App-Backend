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

export const BalanceRoutes = router;
