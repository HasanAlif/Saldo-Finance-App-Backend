import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { goalsController } from "./goals.controller";
import { goalsValidation } from "./goals.validation";

const router = express.Router();

router.post(
  "/",
  validateRequest(goalsValidation.createSchema),
  goalsController.createGoal,
);

router.get("/", goalsController.getAllGoals);

router.get("/:id", goalsController.getGoalById);

router.patch(
  "/:id/progress",
  validateRequest(goalsValidation.addProgressSchema),
  goalsController.addProgress,
);

router.patch("/:id/complete", goalsController.markAsComplete);

router.patch(
  "/:id",
  validateRequest(goalsValidation.updateSchema),
  goalsController.updateGoal,
);

router.delete("/:id", goalsController.deleteGoal);

export const goalsRoutes = router;
