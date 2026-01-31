import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { profileController } from "./profile.controller";
import { profileValidation } from "./profile.validation";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

// Get user profile
router.get("/", auth(), profileController.getProfile);

// Update user profile (with optional image upload)
router.patch(
  "/",
  auth(),
  fileUploader.upload.single("profilePicture"),
  profileController.updateProfile,
);

// Change password
router.post(
  "/change-password",
  auth(),
  validateRequest(profileValidation.changePasswordSchema),
  profileController.changePassword,
);

export const profileRoutes = router;
