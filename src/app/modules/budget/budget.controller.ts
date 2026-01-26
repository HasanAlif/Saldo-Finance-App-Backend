import { Request, Response } from "express";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { budgetService } from "./budget.service";
import { BudgetStatus } from "./budget.model";

const createBudget = catchAsync(async (req: Request, res: Response) => {
  const result = await budgetService.createBudget(req.user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Budget created successfully!",
    data: result,
  });
});

const getBudget = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.query;

  if (!status || (status !== "WEEKLY" && status !== "MONTHLY")) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Status query parameter must be WEEKLY or MONTHLY",
      data: null,
    });
  }

  const result = await budgetService.getBudget(
    req.user.id,
    status as BudgetStatus,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${status} budgets retrieved successfully!`,
    data: result,
  });
});

const updateBudget = catchAsync(async (req: Request, res: Response) => {
  const { budgetId } = req.params;
  const result = await budgetService.updateBudget(
    budgetId,
    req.user.id,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Budget updated successfully!",
    data: result,
  });
});

const deleteBudget = catchAsync(async (req: Request, res: Response) => {
  const { budgetId } = req.params;
  await budgetService.deleteBudget(budgetId, req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Budget deleted successfully!",
    data: null,
  });
});

export const budgetController = {
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
};
