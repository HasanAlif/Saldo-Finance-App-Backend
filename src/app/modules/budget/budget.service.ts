import mongoose from "mongoose";
import { Budget, IBudget, BudgetStatus } from "./budget.model";
import { Spending } from "../balance/spending.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";

interface CreateBudgetPayload {
  category: string;
  budgetValue: number;
  currency: string;
  status: BudgetStatus;
}

// Helper: Get date range for WEEKLY (Sunday to Saturday)
const getWeekDateRange = (): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - dayOfWeek);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

// Helper: Get date range for MONTHLY (1st to last day of current month)
const getMonthDateRange = (): { startDate: Date; endDate: Date } => {
  const now = new Date();

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { startDate, endDate };
};

// Helper: Format date range for response (e.g., "18 January 2026 - 25 January 2026")
const formatDateRange = (startDate: Date, endDate: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const start = startDate.toLocaleDateString("en-GB", options);
  const end = endDate.toLocaleDateString("en-GB", options);
  return `${start} - ${end}`;
};

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
  // Get budgets for user
  const budgets = await Budget.find({ userId, status })
    .select("category budgetValue currency")
    .lean();

  if (budgets.length === 0) {
    const { startDate, endDate } =
      status === "WEEKLY" ? getWeekDateRange() : getMonthDateRange();
    return {
      status,
      dateRange: formatDateRange(startDate, endDate),
      totalBudget: 0,
      totalSpent: 0,
      totalPercentage: 0,
      totalCategories: 0,
      budgets: [],
    };
  }

  // Get date range based on status
  const { startDate, endDate } =
    status === "WEEKLY" ? getWeekDateRange() : getMonthDateRange();

  // Get all unique categories (lowercase for matching)
  const categoryMap = new Map<string, { original: string; currency: string }>();
  budgets.forEach((b) => {
    categoryMap.set(b.category.toLowerCase(), {
      original: b.category,
      currency: b.currency,
    });
  });

  // Aggregate spending by category (case-insensitive) within date range
  const spendingAggregation = await Spending.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $addFields: {
        categoryLower: { $toLower: "$category" },
      },
    },
    {
      $group: {
        _id: { category: "$categoryLower", currency: "$currency" },
        totalSpent: { $sum: "$amount" },
      },
    },
  ]);

  // Build spending lookup map: "category_currency" -> totalSpent
  const spendingMap = new Map<string, number>();
  spendingAggregation.forEach((s) => {
    const key = `${s._id.category}_${s._id.currency.toLowerCase()}`;
    spendingMap.set(key, s.totalSpent);
  });

  // Calculate totals
  const totalBudget = budgets.reduce((sum, b) => sum + b.budgetValue, 0);

  // Build response with spending data
  let totalSpent = 0;
  const budgetsWithSpending = budgets.map((b) => {
    const key = `${b.category.toLowerCase()}_${b.currency.toLowerCase()}`;
    const amountSpent = spendingMap.get(key) || 0;
    totalSpent += amountSpent;

    const spendingPercentage =
      b.budgetValue > 0
        ? Math.round((amountSpent / b.budgetValue) * 100 * 100) / 100
        : 0;

    return {
      id: b._id,
      category: b.category,
      budgetValue: b.budgetValue,
      amountSpent,
      spendingPercentage,
      currency: b.currency,
    };
  });

  const totalPercentage =
    totalBudget > 0
      ? Math.round((totalSpent / totalBudget) * 100 * 100) / 100
      : 0;

  return {
    status,
    dateRange: formatDateRange(startDate, endDate),
    totalBudget,
    totalSpent,
    totalPercentage,
    totalCategories: budgets.length,
    budgets: budgetsWithSpending,
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
