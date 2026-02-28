import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { budgetController } from "./budget.controller";
import { budgetValidation } from "./budget.validation";

const router = express.Router();

router.post(
  "/set-start-date",
  auth(),
  validateRequest(budgetValidation.setMonthStartDateSchema),
  budgetController.setMonthStartDate,
);

router.post(
  "/",
  auth(),
  validateRequest(budgetValidation.createSchema),
  budgetController.createBudget,
);

router.get("/", auth(), budgetController.getBudget);

router.patch(
  "/:budgetId",
  auth(),
  validateRequest(budgetValidation.updateSchema),
  budgetController.updateBudget,
);

router.delete("/:budgetId", auth(), budgetController.deleteBudget);

router.get(
  "/transactions-by-range",
  auth(),
  budgetController.getEarningAndSpendingByRange,
);

export const budgetRoutes = router;
