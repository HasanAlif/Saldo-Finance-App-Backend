import mongoose from "mongoose";
import { Goals, IGoals } from "./goals.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";

const createGoal = async (
  userId: string,
  payload: Partial<IGoals>,
): Promise<IGoals> => {
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  // Create goal with userId
  const goalData = {
    ...payload,
    userId,
    accumulatedAmount: payload.accumulatedAmount ?? 0,
    status: "IN_PROGRESS",
  };

  const result = await Goals.create(goalData);
  return result;
};

const getAllGoals = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const goals = await Goals.find({ userId }).sort({ createdAt: -1 }).lean();

  // Calculate progress and filter data for each goal
  const goalsWithProgress = goals.map((goal) => {
    const amountLeft = Math.max(0, goal.targetAmount - goal.accumulatedAmount);
    const progressPercentage = Math.min(
      100,
      Math.round((goal.accumulatedAmount / goal.targetAmount) * 100),
    );

    return {
      id: goal._id,
      name: goal.name,
      notes: goal.notes || null,
      targetAmount: goal.targetAmount,
      accumulatedAmount: goal.accumulatedAmount,
      amountLeft,
      progressPercentage,
    };
  });

  // Calculate overall completion stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter(
    (goal) => goal.status === "COMPLETED",
  ).length;

  // Calculate total money left across all goals
  const totalLeft = goalsWithProgress.reduce(
    (sum, goal) => sum + goal.amountLeft,
    0,
  );

  return {
    totalLeft,
    fullfilledGoals: `${completedGoals}/${totalGoals}`,
    goals: goalsWithProgress,
  };
};

const getGoalById = async (
  userId: string,
  goalId: string,
): Promise<IGoals | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid goal ID");
  }

  const goal = await Goals.findOne({ _id: goalId, userId }).lean();

  if (!goal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Goal not found");
  }

  return goal;
};

const updateGoal = async (
  userId: string,
  goalId: string,
  payload: Partial<IGoals>,
): Promise<IGoals | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid goal ID");
  }

  // Prevent direct modification of sensitive fields
  const updateData = { ...payload };
  delete (updateData as any).userId;
  delete (updateData as any).status;
  delete (updateData as any)._id;

  const result = await Goals.findOneAndUpdate(
    { _id: goalId, userId },
    { $set: updateData },
    { new: true, runValidators: true },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Goal not found");
  }

  return result;
};

const deleteGoal = async (
  userId: string,
  goalId: string,
): Promise<IGoals | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid goal ID");
  }

  const result = await Goals.findOneAndDelete({ _id: goalId, userId });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Goal not found");
  }

  return result;
};

const addProgress = async (
  userId: string,
  goalId: string,
  amount: number,
): Promise<IGoals | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid goal ID");
  }

  // Validate amount
  if (amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Amount must be greater than 0");
  }

  // Find the goal first
  const goal = await Goals.findOne({ _id: goalId, userId });

  if (!goal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Goal not found");
  }

  // Check if goal is already completed
  if (goal.status === "COMPLETED") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot add progress to a completed goal",
    );
  }

  // Calculate new accumulated amount
  const newAccumulatedAmount = goal.accumulatedAmount + amount;

  // Prevent exceeding target amount
  if (newAccumulatedAmount > goal.targetAmount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Adding ${amount} would exceed the target amount. Maximum you can add: ${
        goal.targetAmount - goal.accumulatedAmount
      }`,
    );
  }

  // Update accumulated amount
  goal.accumulatedAmount = newAccumulatedAmount;

  // Auto-complete if target reached
  if (newAccumulatedAmount >= goal.targetAmount) {
    goal.status = "COMPLETED";
  }

  await goal.save();

  return goal.toObject();
};

const markAsComplete = async (
  userId: string,
  goalId: string,
): Promise<IGoals | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(goalId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid goal ID");
  }

  // Find the goal first
  const goal = await Goals.findOne({ _id: goalId, userId });

  if (!goal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Goal not found");
  }

  // Check if goal is already completed
  if (goal.status === "COMPLETED") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Goal is already completed");
  }

  // Mark as complete and set accumulated amount to target amount
  goal.status = "COMPLETED";
  goal.accumulatedAmount = goal.targetAmount;

  await goal.save();

  return goal.toObject();
};

export const goalsService = {
  createGoal,
  getAllGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  addProgress,
  markAsComplete,
};
