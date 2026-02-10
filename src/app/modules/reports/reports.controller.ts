import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { reportsService } from "./reports.service";
import { Request, Response } from "express";

const getWeeklyReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await reportsService.getWeeklyReport(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Weekly report retrieved successfully",
    data: result,
  });
});

const getMonthlyReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const month = req.query.month as string | undefined;
  const result = await reportsService.getMonthlyReport(userId, month);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Monthly report retrieved successfully",
    data: result,
  });
});

export const reportsController = {
  getWeeklyReport,
  getMonthlyReport,
};
