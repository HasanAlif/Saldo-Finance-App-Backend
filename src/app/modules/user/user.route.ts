import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";
import { userController } from "./user.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.post(
  "/register",
  validateRequest(UserValidation.CreateUserValidationSchema),
  userController.createUser,
);

router.put(
  "/profile-image",
  auth(),
  fileUploader.uploadSingle,
  userController.profileImageChange,
);

router.put(
  "/profile",
  auth(),
  fileUploader.uploadSingle,
  userController.updateProfile,
);

router.patch(
  "/account",
  auth(),
  validateRequest(UserValidation.UpdateProfileSchema),
  userController.accountUpdate,
);

router.post(
  "/profile-setup",
  auth(),
  validateRequest(UserValidation.UserProfileSetupSchema),
  userController.setupProfile,
);

router.delete("/me", auth(), userController.deleteMe);

router.get("/", auth(UserRole.ADMIN), userController.getUsers);

router.put("/:id", auth(UserRole.ADMIN), userController.updateUser);

export const userRoutes = router;
