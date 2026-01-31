import express from "express";
import auth from "../../middlewares/auth";
import { profileController } from "./profile.controller";
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

export const profileRoutes = router;
