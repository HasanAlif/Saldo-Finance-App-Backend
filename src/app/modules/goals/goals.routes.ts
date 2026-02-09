import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { goalsController } from "./goals.controller";
import { goalsValidation } from "./goals.validation";

const router = express.Router();

router.post(
  "/",
  auth(),
  validateRequest(goalsValidation.createSchema),
  goalsController.createGoal,
);

router.get("/", auth(), goalsController.getAllGoals);

router.get("/:id", auth(), goalsController.getGoalById);

router.patch(
  "/:id/progress",
  auth(),
  validateRequest(goalsValidation.addProgressSchema),
  goalsController.addProgress,
);

router.patch("/:id/complete", auth(), goalsController.markAsComplete);

router.patch(
  "/:id",
  auth(),
  validateRequest(goalsValidation.updateSchema),
  goalsController.updateGoal,
);

router.delete("/:id", auth(), goalsController.deleteGoal);

export const goalsRoutes = router;
