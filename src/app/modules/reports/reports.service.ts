import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { Balance } from "../balance/balance.model";
import { Goals } from "../goals/goals.model";
import { User } from "../../models/User.model";

const getWeekRange = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const startDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday,
      0,
      0,
      0,
      0,
    ),
  );

  const endDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday + 6,
      23,
      59,
      59,
      999,
    ),
  );

  return { startDate, endDate };
};

const getMonthRange = (monthStartDate: number, month?: string) => {
  let startDate: Date;
  let endDate: Date;

  if (month) {
    const [year, monthNum] = month.split("-").map(Number);

    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid month format. Use YYYY-MM (e.g., 2026-01)",
      );
    }

    startDate = new Date(
      Date.UTC(year, monthNum - 1, monthStartDate, 0, 0, 0, 0),
    );
    endDate = new Date(
      Date.UTC(year, monthNum, monthStartDate - 1, 23, 59, 59, 999),
    );
  } else {
    const now = new Date();
    const currentDay = now.getUTCDate();

    if (currentDay >= monthStartDate) {
      startDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          monthStartDate,
          0,
          0,
          0,
          0,
        ),
      );
      endDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          monthStartDate - 1,
          23,
          59,
          59,
          999,
        ),
      );
    } else {
      startDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - 1,
          monthStartDate,
          0,
          0,
          0,
          0,
        ),
      );
      endDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          monthStartDate - 1,
          23,
          59,
          59,
          999,
        ),
      );
    }
  }

  return { startDate, endDate };
};

const buildReport = async (userId: string, startDate: Date, endDate: Date) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const dateFilter = { $gte: startDate, $lte: endDate };

  const [
    incomeTotal,
    spendingTotal,
    highestSpendingCat,
    currentBalance,
    goalsData,
    incomeEntries,
    spendingEntries,
  ] = await Promise.all([
    Income.aggregate([
      { $match: { userId: userObjectId, date: dateFilter } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Spending.aggregate([
      { $match: { userId: userObjectId, date: dateFilter } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Spending.aggregate([
      { $match: { userId: userObjectId, date: dateFilter } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]),

    Balance.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    Goals.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalTarget: { $sum: "$targetAmount" },
          totalAccumulated: { $sum: "$accumulatedAmount" },
          totalGoals: { $sum: 1 },
        },
      },
    ]),

    Income.find({ userId: userObjectId, date: dateFilter })
      .select("date category amount name")
      .sort({ date: -1 })
      .lean(),

    Spending.find({ userId: userObjectId, date: dateFilter })
      .select("date category amount name")
      .sort({ date: -1 })
      .lean(),
  ]);

  const totalEarning = incomeTotal.length > 0 ? incomeTotal[0].total : 0;
  const totalSpending = spendingTotal.length > 0 ? spendingTotal[0].total : 0;
  const balance = currentBalance.length > 0 ? currentBalance[0].total : 0;

  const highestSpendingCategory =
    highestSpendingCat.length > 0
      ? {
          category: highestSpendingCat[0]._id,
          amount: highestSpendingCat[0].total,
        }
      : null;

  const goalTarget = goalsData.length > 0 ? goalsData[0].totalTarget : 0;
  const goalAccumulated =
    goalsData.length > 0 ? goalsData[0].totalAccumulated : 0;
  const goalPercentage =
    goalTarget > 0 ? Math.round((goalAccumulated / goalTarget) * 100) : 0;

  const goalProgress = {
    completed: goalAccumulated,
    total: goalTarget,
    percentage: goalPercentage,
    summary: `${goalAccumulated} of ${goalTarget}`,
  };

  const earningList = incomeEntries.map((e) => ({
    date: e.date,
    category: e.category,
    name: e.name,
    amount: e.amount,
  }));

  const spendingList = spendingEntries.map((e) => ({
    date: e.date,
    category: e.category,
    name: e.name,
    amount: e.amount,
  }));

  const allEntries = [
    ...incomeEntries.map((e) => ({
      date: e.date,
      type: "earning" as const,
      category: e.category,
      name: e.name,
      amount: e.amount,
    })),
    ...spendingEntries.map((e) => ({
      date: e.date,
      type: "spending" as const,
      category: e.category,
      name: e.name,
      amount: e.amount,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    totalEarning,
    totalSpending,
    currentBalance: balance,
    highestSpendingCategory,
    goalProgress,
    entries: {
      all: allEntries,
      earning: earningList,
      spending: spendingList,
    },
  };
};

const getWeeklyReport = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const { startDate, endDate } = getWeekRange();

  return buildReport(userId, startDate, endDate);
};

const getMonthlyReport = async (userId: string, month?: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(userId).select("monthStartDate").lean();
  const monthStartDate = user?.monthStartDate || 1;

  const { startDate, endDate } = getMonthRange(monthStartDate, month);

  return buildReport(userId, startDate, endDate);
};

export const reportsService = {
  getWeeklyReport,
  getMonthlyReport,
};
