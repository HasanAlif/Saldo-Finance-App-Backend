import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "../user/user.validation";
import { AuthController } from "./auth.controller";
import { authValidation } from "./auth.validation";

const router = express.Router();

router.post(
  "/login",
  validateRequest(UserValidation.UserLoginValidationSchema),
  AuthController.loginUser,
);

router.post("/logout", AuthController.logoutUser);

router.get("/me", auth(), AuthController.getMyProfile);

router.put(
  "/change-password",
  auth(),
  validateRequest(authValidation.changePasswordValidationSchema),
  AuthController.changePassword,
);

router.post(
  "/forgot-password",
  validateRequest(authValidation.forgotPasswordSchema),
  AuthController.forgotPassword,
);

router.post(
  "/resend-otp",
  validateRequest(authValidation.resendOtpSchema),
  AuthController.resendOtp,
);

router.post(
  "/verify-otp",
  validateRequest(authValidation.verifyOtpSchema),
  AuthController.verifyForgotPasswordOtp,
);

router.post(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidationSchema),
  AuthController.resetPassword,
);

router.post(
  "/social-login",
  validateRequest(authValidation.socialLoginValidationSchema),
  AuthController.socialLogin,
);

export const authRoutes = router;
