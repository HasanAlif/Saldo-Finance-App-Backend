import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { lentController } from "./lent.controller";
import { lentValidation } from "./lent.validation";

const router = express.Router();

router.post(
  "/",
  validateRequest(lentValidation.createSchema),
  lentController.createLent,
);

router.get("/", lentController.getAllLent);

router.get("/:id", lentController.getLentById);

router.patch(
  "/:id/payment",
  validateRequest(lentValidation.addPaymentSchema),
  lentController.addPayment,
);

router.patch("/:id/paid", lentController.markAsPaid);

router.patch(
  "/:id",
  validateRequest(lentValidation.updateSchema),
  lentController.updateLent,
);

router.delete("/:id", lentController.deleteLent);

export const lentRoutes = router;
