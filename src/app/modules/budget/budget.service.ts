import mongoose from "mongoose";
import { Budget, IBudget, BudgetStatus } from "./budget.model";
import { Spending } from "../balance/spending.model";
import { User } from "../../models/User.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { Income } from "../balance/income.model";

interface CreateBudgetPayload {
  category: string;
  budgetValue: number;
  currency: string;
  status: BudgetStatus;
}

const getCustomMonthDateRange = (
  monthStartDate: number = 1,
): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentDay = now.getDate();

  let startDate: Date;
  let endDate: Date;

  if (currentDay >= monthStartDate) {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      monthStartDate,
      0,
      0,
      0,
      0,
    );
    endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      monthStartDate - 1,
      23,
      59,
      59,
      999,
    );
  } else {
    startDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      monthStartDate,
      0,
      0,
      0,
      0,
    );
    endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      monthStartDate - 1,
      23,
      59,
      59,
      999,
    );
  }

  return { startDate, endDate };
};

const getCustomWeekDateRange = (
  monthStartDate: number = 1,
): { startDate: Date; endDate: Date } => {
  const { startDate: cycleStart, endDate: cycleEnd } =
    getCustomMonthDateRange(monthStartDate);
  const now = new Date();

  const daysSinceCycleStart = Math.floor(
    (now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  const weekNumber = Math.max(0, Math.floor(daysSinceCycleStart / 7));

  const startDate = new Date(cycleStart);
  startDate.setDate(cycleStart.getDate() + weekNumber * 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  if (endDate > cycleEnd) {
    endDate.setTime(cycleEnd.getTime());
  }

  return { startDate, endDate };
};

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

const setMonthStartDate = async (userId: string, monthStartDate: number) => {
  const result = await User.findByIdAndUpdate(
    userId,
    { monthStartDate },
    { new: true, select: "monthStartDate" },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return { monthStartDate: result.monthStartDate };
};

const getMonthStartDate = async (userId: string) => {
  const user = await User.findById(userId).select("monthStartDate").lean();

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return { monthStartDate: user.monthStartDate };
};

const createBudget = async (
  userId: string,
  payload: CreateBudgetPayload,
): Promise<IBudget> => {
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
  const user = await User.findById(userId).select("monthStartDate").lean();
  const monthStartDate = user?.monthStartDate || 1;

  const { startDate, endDate } =
    status === "WEEKLY"
      ? getCustomWeekDateRange(monthStartDate)
      : getCustomMonthDateRange(monthStartDate);

  const budgets = await Budget.find({ userId, status })
    .select("category budgetValue currency")
    .lean();

  if (budgets.length === 0) {
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

  const categoryMap = new Map<string, { original: string; currency: string }>();
  budgets.forEach((b) => {
    categoryMap.set(b.category.toLowerCase(), {
      original: b.category,
      currency: b.currency || "",
    });
  });

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

  const spendingMap = new Map<string, number>();
  spendingAggregation.forEach((s) => {
    const key = `${s._id.category}_${s._id.currency?.toLowerCase() || ""}`;
    spendingMap.set(key, s.totalSpent);
  });

  const totalBudget = budgets.reduce((sum, b) => sum + b.budgetValue, 0);

  let totalSpent = 0;
  const budgetsWithSpending = budgets.map((b) => {
    const key = `${b.category.toLowerCase()}_${b.currency?.toLowerCase() || ""}`;
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
      currency: b.currency || "",
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

const getEarningAndSpendingByRange = async (
  userId: string,
  startDate: Date,
  endDate: Date,
) => {
  const uid = new mongoose.Types.ObjectId(userId);

  const matchStage = { userId: uid, date: { $gte: startDate, $lte: endDate } };
  const groupStage = {
    _id: { $dateToString: { format: "%Y-%m-%dT00:00:00.000Z", date: "$date" } },
    amount: { $sum: "$amount" },
  };

  const [incomeAgg, spendingAgg] = await Promise.all([
    Income.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", amount: 1 } },
    ]),
    Spending.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", amount: 1 } },
    ]),
  ]);

  return {
    earning: incomeAgg,
    spending: spendingAgg,
  };
};

export const budgetService = {
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
  setMonthStartDate,
  getMonthStartDate,
  getEarningAndSpendingByRange,
};
