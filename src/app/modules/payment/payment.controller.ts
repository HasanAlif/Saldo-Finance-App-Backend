import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { paymentService } from "./payment.service";

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const { plan } = req.body;
    const result = await paymentService.createCheckoutSession(
      req.user.id,
      plan,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Checkout session created successfully",
      data: result,
    });
  },
);

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;

  if (!signature) {
    res
      .status(httpStatus.BAD_REQUEST)
      .json({ error: "Missing stripe-signature header" });
    return;
  }

  const result = await paymentService.handleWebhookEvent(req.body, signature);

  res.status(httpStatus.OK).json(result);
});

const getCurrentPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getCurrentPlan(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Current plan retrieved successfully",
    data: result,
  });
});

export const paymentController = {
  createCheckoutSession,
  handleWebhook,
  getCurrentPlan,
};
