import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { goalsService } from "./goals.service";
import { Request, Response } from "express";

const createGoal = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await goalsService.createGoal(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Goal created successfully",
    data: result,
  });
});

const getAllGoals = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const result = await goalsService.getAllGoals(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Goals retrieved successfully",
    data: result,
  });
});

const getGoalById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await goalsService.getGoalById(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Goal retrieved successfully",
    data: result,
  });
});

const updateGoal = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await goalsService.updateGoal(userId, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Goal updated successfully",
    data: result,
  });
});

const deleteGoal = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  await goalsService.deleteGoal(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Goal deleted successfully",
    data: null,
  });
});

const addProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { amount } = req.body;
  const result = await goalsService.addProgress(userId, id, amount);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Progress added successfully",
    data: result,
  });
});

const markAsComplete = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const result = await goalsService.markAsComplete(userId, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Goal marked as complete successfully",
    data: result,
  });
});

export const goalsController = {
  createGoal,
  getAllGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  addProgress,
  markAsComplete,
};
