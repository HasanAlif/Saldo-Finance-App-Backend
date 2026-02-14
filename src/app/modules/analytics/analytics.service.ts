import mongoose from "mongoose";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { Balance } from "../balance/balance.model";

// Income vs Expenses — yearly breakdown by month
const getIncomeVsExpenses = async (userId: string, year: number) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const matchStage = { userId: uid, date: { $gte: start, $lt: end } };
  const groupStage = {
    _id: { month: { $month: "$date" } },
    total: { $sum: "$amount" },
  };

  const [incomeAgg, spendingAgg] = await Promise.all([
    Income.aggregate([{ $match: matchStage }, { $group: groupStage }]),
    Spending.aggregate([{ $match: matchStage }, { $group: groupStage }]),
  ]);

  const incomeMap = new Map<number, number>();
  const spendingMap = new Map<number, number>();

  incomeAgg.forEach((i) => incomeMap.set(i._id.month, i.total));
  spendingAgg.forEach((s) => spendingMap.set(s._id.month, s.total));

  let totalIncome = 0;
  let totalExpenses = 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const income = incomeMap.get(i + 1) || 0;
    const expenses = spendingMap.get(i + 1) || 0;
    totalIncome += income;
    totalExpenses += expenses;
    return { month: i + 1, income, expenses };
  });

  return {
    year,
    months,
    totalIncome,
    totalExpenses,
    avgMonthlyIncome: Math.round((totalIncome / 12) * 100) / 100,
    avgMonthlyExpenses: Math.round((totalExpenses / 12) * 100) / 100,
  };
};

// Balance Trend — daily closing balance for a given month
const getBalanceTrend = async (userId: string, year: number, month: number) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = new Date(Date.UTC(year, month - 1, daysInMonth + 1));

  const matchStage = { userId: uid, date: { $gte: start, $lt: end } };
  const groupStage = {
    _id: { day: { $dayOfMonth: "$date" } },
    total: { $sum: "$amount" },
  };

  const [currentBalanceAgg, incomeAgg, spendingAgg] = await Promise.all([
    Balance.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Income.aggregate([{ $match: matchStage }, { $group: groupStage }]),
    Spending.aggregate([{ $match: matchStage }, { $group: groupStage }]),
  ]);

  const currentBalance = currentBalanceAgg[0]?.total || 0;

  // Check if there are any transactions in this month
  const hasTransactions = incomeAgg.length > 0 || spendingAgg.length > 0;

  if (!hasTransactions) {
    return {
      year,
      month,
      daysInMonth,
      trend: null,
      currentBalance: Math.round(currentBalance * 100) / 100,
      growthPercentage: 0,
      message: "No transactions found for this month",
    };
  }

  const incomeMap = new Map<number, number>();
  const spendingMap = new Map<number, number>();
  incomeAgg.forEach((i) => incomeMap.set(i._id.day, i.total));
  spendingAgg.forEach((s) => spendingMap.set(s._id.day, s.total));

  // Calculate net change per day
  const dailyNet: { day: number; net: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const income = incomeMap.get(d) || 0;
    const expense = spendingMap.get(d) || 0;
    dailyNet.push({ day: d, net: income - expense });
  }

  // Calculate total net change from month start to now (after this month)
  const now = new Date();
  const isCurrentMonth =
    now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
  const lastDay = isCurrentMonth
    ? Math.min(now.getUTCDate(), daysInMonth)
    : daysInMonth;

  // Sum all net changes after lastDay to subtract from currentBalance
  // to get the closing balance at lastDay
  // Then work backwards
  let futureNetAfterMonth = 0;

  // Get all income/spending AFTER this month to subtract from current balance
  const afterEnd = new Date();
  if (afterEnd > end) {
    const [futureIncome, futureSpending] = await Promise.all([
      Income.aggregate([
        { $match: { userId: uid, date: { $gte: end, $lte: afterEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Spending.aggregate([
        { $match: { userId: uid, date: { $gte: end, $lte: afterEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);
    futureNetAfterMonth =
      (futureIncome[0]?.total || 0) - (futureSpending[0]?.total || 0);
  }

  // closing balance at end of last day of the month
  let runningBalance = currentBalance - futureNetAfterMonth;
  const endBalance = runningBalance;

  // Work backwards from lastDay to build daily balances
  const trend: { day: number; balance: number }[] = [];
  for (let d = lastDay; d >= 1; d--) {
    trend.unshift({
      day: d,
      balance: Math.round(runningBalance * 100) / 100,
    });
    runningBalance -= dailyNet[d - 1].net;
  }

  // Calculate the balance at the start of the month (before day 1)
  const startBalance = runningBalance;

  // Calculate growth percentage
  const growthPercentage =
    startBalance !== 0
      ? Math.round(
          ((endBalance - startBalance) / Math.abs(startBalance)) * 10000,
        ) / 100
      : endBalance > 0
        ? 100
        : 0;

  return {
    year,
    month,
    daysInMonth: lastDay,
    currentBalance: Math.round(currentBalance * 100) / 100,
    growthPercentage,
    trend,
  };
};

// Spending by Category — monthly breakdown with percentages
const getSpendingByCategory = async (
  userId: string,
  year: number,
  month: number,
) => {
  const uid = new mongoose.Types.ObjectId(userId);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = new Date(Date.UTC(year, month - 1, daysInMonth + 1));

  const result = await Spending.aggregate([
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: "$category",
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  const totalSpending = result.reduce((sum, r) => sum + r.amount, 0);

  const categories = result.map((r) => ({
    category: r._id,
    amount: Math.round(r.amount * 100) / 100,
    count: r.count,
    percentage:
      totalSpending > 0
        ? Math.round((r.amount / totalSpending) * 10000) / 100
        : 0,
  }));

  return {
    year,
    month,
    totalSpending: Math.round(totalSpending * 100) / 100,
    categories,
  };
};

export const analyticsService = {
  getIncomeVsExpenses,
  getBalanceTrend,
  getSpendingByCategory,
};
