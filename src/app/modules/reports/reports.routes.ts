import express from "express";
import auth from "../../middlewares/auth";
import { reportsController } from "./reports.controller";

const router = express.Router();

router.get("/weekly", auth(), reportsController.getWeeklyReport);

router.get("/monthly", auth(), reportsController.getMonthlyReport);

export const reportsRoutes = router;
