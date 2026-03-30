import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { fcmTokenService } from "./fcm-token.service";

const registerToken = catchAsync(async (req: Request, res: Response) => {
  const result = await fcmTokenService.registerToken(req.user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FCM token registered successfully",
    data: result,
  });
});

const deleteToken = catchAsync(async (req: Request, res: Response) => {
  const result = await fcmTokenService.deleteToken(
    req.user.id,
    req.body.deviceId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FCM token deleted successfully",
    data: result,
  });
});

export const fcmTokenController = {
  registerToken,
  deleteToken,
};
