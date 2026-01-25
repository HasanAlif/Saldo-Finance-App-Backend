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

const addIncomeToAccount = catchAsync(async (req: Request, res: Response) => {
  const { accountId, ...incomeData } = req.body;
  const result = await balanceService.addIncomeToAccount(
    req.user.id,
    accountId,
    incomeData,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Income added successfully!",
    data: result,
  });
});

const addSpendingToAccount = catchAsync(async (req: Request, res: Response) => {
  const { accountId, ...spendingData } = req.body;
  const result = await balanceService.addSpendingToAccount(
    req.user.id,
    accountId,
    spendingData,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Spending added successfully!",
    data: result,
  });
});

const getIncomeSpendingByDate = catchAsync(
  async (req: Request, res: Response) => {
    const { date } = req.query;

    if (!date || typeof date !== "string") {
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: "Date query parameter is required",
        data: null,
      });
    }

    const result = await balanceService.getIncomeSpendingByDate(
      req.user.id,
      date,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Daily income and spending retrieved successfully!",
      data: result,
    });
  },
);

export const balanceController = {
  createAccount,
  getTotalAccount,
  updateAccount,
  deleteAccount,
  addIncomeToAccount,
  addSpendingToAccount,
  getIncomeSpendingByDate,
};
