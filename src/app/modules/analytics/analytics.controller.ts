import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { analyticsService } from "./analytics.service";

const getIncomeVsExpenses = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const result = await analyticsService.getIncomeVsExpenses(userId, year);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Income vs expenses retrieved successfully",
    data: result,
  });
});

const getBalanceTrend = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const year = parseInt(req.query.year as string) || now.getFullYear();
  const month = parseInt(req.query.month as string) || now.getMonth() + 1;

  const result = await analyticsService.getBalanceTrend(userId, year, month);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Balance trend retrieved successfully",
    data: result,
  });
});

const getSpendingByCategory = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const year = parseInt(req.query.year as string) || now.getFullYear();
  const month = parseInt(req.query.month as string) || now.getMonth() + 1;

  const result = await analyticsService.getSpendingByCategory(
    userId,
    year,
    month,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Spending by category retrieved successfully",
    data: result,
  });
});

export const analyticsController = {
  getIncomeVsExpenses,
  getBalanceTrend,
  getSpendingByCategory,
};
