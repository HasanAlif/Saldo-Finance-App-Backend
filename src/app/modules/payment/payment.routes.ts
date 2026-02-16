import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { paymentController } from "./payment.controller";
import { paymentValidation } from "./payment.validation";

const router = express.Router();

router.post(
  "/create-checkout-session",
  auth(),
  validateRequest(paymentValidation.createCheckoutSessionSchema),
  paymentController.createCheckoutSession,
);

router.get("/current-plan", auth(), paymentController.getCurrentPlan);


export const paymentRoutes = router;
