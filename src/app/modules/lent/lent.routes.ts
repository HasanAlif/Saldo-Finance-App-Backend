import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { lentController } from "./lent.controller";
import { lentValidation } from "./lent.validation";

const router = express.Router();

router.post(
  "/",
  auth(),
  validateRequest(lentValidation.createSchema),
  lentController.createLent,
);

router.get("/", auth(), lentController.getAllLent);

router.get("/:id", auth(), lentController.getLentById);

router.patch(
  "/:id/payment",
  auth(),
  validateRequest(lentValidation.addPaymentSchema),
  lentController.addPayment,
);

router.patch("/:id/paid", auth(), lentController.markAsPaid);

router.patch(
  "/:id",
  auth(),
  validateRequest(lentValidation.updateSchema),
  lentController.updateLent,
);

router.delete("/:id", auth(), lentController.deleteLent);

export const lentRoutes = router;
