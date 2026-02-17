import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { borrowedController } from "./borrowed.controller";
import { borrowedValidation } from "./borrowed.validation";

const router = express.Router();

router.post(
  "/",
  validateRequest(borrowedValidation.createSchema),
  borrowedController.createBorrowed,
);

router.get("/", borrowedController.getAllBorrowed);

router.get("/:id", borrowedController.getBorrowedById);

router.patch(
  "/:id/payment",
  validateRequest(borrowedValidation.addPaymentSchema),
  borrowedController.addPayment,
);

router.patch("/:id/paid", borrowedController.markAsPaid);

router.patch(
  "/:id",
  validateRequest(borrowedValidation.updateSchema),
  borrowedController.updateBorrowed,
);

router.delete("/:id", borrowedController.deleteBorrowed);

export const borrowedRoutes = router;
