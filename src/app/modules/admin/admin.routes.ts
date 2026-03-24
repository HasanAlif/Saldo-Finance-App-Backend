import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { adminController } from "./admin.controller";
import { UserRole } from "../../models";

const router = express.Router();

router.get("/users-count", auth(UserRole.ADMIN), adminController.getUsersCount);

export const adminRoutes = router;
