import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { balanceService } from "./balance.service";

const createAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await balanceService.createAccount(req.user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Account created successfully!",
    data: result,
  });
});

const getTotalAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await balanceService.getTotalAccount(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Total account amount retrieved successfully!",
    data: result,
  });
});

const updateAccount = catchAsync(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const result = await balanceService.updateAccount(
    accountId,
    req.user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account updated successfully!",
    data: result,
  });
});

const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const { accountId } = req.params;
  await balanceService.deleteAccount(accountId, req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted successfully!",
    data: null,
  });
});

export const balanceController = {
  createAccount,
  getTotalAccount,
  updateAccount,
  deleteAccount,
};
