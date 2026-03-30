import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { fcmTokenController } from "./fcm-token.controller";
import { fcmTokenValidation } from "./fcm-token.validation";

const router = express.Router();

router.post(
  "/register",
  auth(),
  validateRequest(fcmTokenValidation.registerTokenSchema),
  fcmTokenController.registerToken,
);

router.delete(
  "/",
  auth(),
  validateRequest(fcmTokenValidation.deleteTokenSchema),
  fcmTokenController.deleteToken,
);

export const fcmTokenRoutes = router;
