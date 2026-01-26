import { Budget, IBudget, BudgetStatus } from "./budget.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";

interface CreateBudgetPayload {
  category: string;
  budgetValue: number;
  currency: string;
  status: BudgetStatus;
}

const createBudget = async (
  userId: string,
  payload: CreateBudgetPayload,
): Promise<IBudget> => {
  // Check if budget already exists for this category and status
  const existingBudget = await Budget.findOne({
    userId,
    category: payload.category,
    status: payload.status,
  });

  if (existingBudget) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Budget for ${payload.category} (${payload.status}) already exists`,
    );
  }

  const result = await Budget.create({
    userId,
    category: payload.category,
    budgetValue: payload.budgetValue,
    currency: payload.currency,
    status: payload.status,
  });

  return result;
};

const getBudget = async (userId: string, status: BudgetStatus) => {
  const budgets = await Budget.find({
    userId,
    status,
  })
    .select("category budgetValue currency")
    .lean();

  const totalBudget = budgets.reduce((sum, b) => sum + b.budgetValue, 0);

  return {
    status,
    totalBudget,
    totalCategories: budgets.length,
    budgets: budgets.map((b) => ({
      id: b._id,
      category: b.category,
      budgetValue: b.budgetValue,
      currency: b.currency,
    })),
  };
};

const updateBudget = async (
  budgetId: string,
  userId: string,
  payload: Partial<CreateBudgetPayload>,
) => {
  const result = await Budget.findOneAndUpdate(
    { _id: budgetId, userId },
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Budget not found");
  }

  return result;
};

const deleteBudget = async (budgetId: string, userId: string) => {
  const result = await Budget.findOneAndDelete({
    _id: budgetId,
    userId,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Budget not found");
  }

  return null;
};

export const budgetService = {
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
};
