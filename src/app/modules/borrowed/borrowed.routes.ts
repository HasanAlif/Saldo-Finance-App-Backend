import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { borrowedController } from "./borrowed.controller";
import { borrowedValidation } from "./borrowed.validation";

const router = express.Router();

router.post(
  "/",
  auth(),
  validateRequest(borrowedValidation.createSchema),
  borrowedController.createBorrowed,
);

router.get("/", auth(), borrowedController.getAllBorrowed);

router.get("/:id", auth(), borrowedController.getBorrowedById);

router.patch(
  "/:id/payment",
  auth(),
  validateRequest(borrowedValidation.addPaymentSchema),
  borrowedController.addPayment,
);

router.patch("/:id/paid", auth(), borrowedController.markAsPaid);

router.patch(
  "/:id",
  auth(),
  validateRequest(borrowedValidation.updateSchema),
  borrowedController.updateBorrowed,
);

router.delete("/:id", auth(), borrowedController.deleteBorrowed);

export const borrowedRoutes = router;
