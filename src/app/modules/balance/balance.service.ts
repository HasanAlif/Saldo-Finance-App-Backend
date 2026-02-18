import httpStatus from "http-status";
import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { User } from "../../models/User.model";
import { notificationServices } from "../notification/notification.service";
import { Balance, IBalance } from "./balance.model";
import { Income } from "./income.model";
import { Spending } from "./spending.model";

// Create a new Account Balance
const createAccount = async (
  userId: string,
  payload: Partial<IBalance>,
): Promise<IBalance> => {
  const result = await Balance.create({
    ...payload,
    userId,
    lastUpdated: new Date(),
  });
  return result;
};

const getTotalAccount = async (userId: string) => {
  const accounts = await Balance.find({
    userId,
  })
    .select("name amount currency")
    .lean();

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  return {
    accounts: accounts.map((account) => ({
      id: account._id,
      name: account.name,
      amount: account.amount,
      currency: account.currency,
    })),
    totalBalance,
    totalAccounts: accounts.length,
  };
};

const updateAccount = async (
  accountId: string,
  userId: string,
  payload: Partial<IBalance>,
) => {
  const result = await Balance.findOneAndUpdate(
    { _id: accountId, userId },
    { ...payload, lastUpdated: new Date() },
    { new: true },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
  }

  return result;
};

const deleteAccount = async (accountId: string, userId: string) => {
  const result = await Balance.findOneAndDelete({
    _id: accountId,
    userId,
  }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
  }

  return result;
};

const addIncomeToAccount = async (
  userId: string,
  accountId: string,
  payload: {
    name: string;
    category: string;
    amount: number;
    currency: string;
    date: Date;
    time: string;
    fillForAllYear: boolean;
  },
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify account exists and belongs to user
    const account = await Balance.findOne({
      _id: accountId,
      userId,
    }).session(session);

    if (!account) {
      throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
    }

    // Create income record
    const income = await Income.create(
      [
        {
          userId,
          accountId,
          name: payload.name,
          category: payload.category,
          amount: payload.amount,
          currency: payload.currency,
          date: payload.date,
          time: payload.time,
          fillForAllYear: payload.fillForAllYear,
        },
      ],
      { session },
    );

    // Update account balance
    const updatedAccount = await Balance.findByIdAndUpdate(
      accountId,
      {
        $inc: { amount: payload.amount },
        lastUpdated: new Date(),
      },
      { new: true, session },
    ).lean();

    await session.commitTransaction();

    // Fire-and-forget: send transaction notification
    notificationServices
      .sendTransactionNotification(
        userId,
        "income",
        payload.category,
        payload.amount,
        payload.currency,
      )
      .catch(() => {});

    return {
      income: income[0],
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const addSpendingToAccount = async (
  userId: string,
  accountId: string,
  payload: {
    name: string;
    category: string;
    amount: number;
    currency: string;
    date: Date;
    time: string;
  },
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify account exists and belongs to user
    const account = await Balance.findOne({
      _id: accountId,
      userId,
    }).session(session);

    if (!account) {
      throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
    }

    // Check if account has sufficient balance
    if (account.amount < payload.amount) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Insufficient balance in account",
      );
    }

    // Create spending record
    const spending = await Spending.create(
      [
        {
          userId,
          accountId,
          name: payload.name,
          category: payload.category,
          amount: payload.amount,
          currency: payload.currency,
          date: payload.date,
          time: payload.time,
        },
      ],
      { session },
    );

    // Update account balance (decrease)
    const updatedAccount = await Balance.findByIdAndUpdate(
      accountId,
      {
        $inc: { amount: -payload.amount },
        lastUpdated: new Date(),
      },
      { new: true, session },
    ).lean();

    await session.commitTransaction();

    // Fire-and-forget: send transaction notification + check budget alerts
    notificationServices
      .sendTransactionNotification(
        userId,
        "spending",
        payload.category,
        payload.amount,
        payload.currency,
      )
      .catch(() => {});

    notificationServices
      .checkBudgetAlerts(userId, payload.category)
      .catch(() => {});

    return {
      spending: spending[0],
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getIncomeSpendingByDate = async (userId: string, date: string) => {
  // Parse the date string
  const targetDate = new Date(date);

  if (isNaN(targetDate.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid date format");
  }

  // Create start and end of the day in UTC
  const startDate = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const endDate = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  // Calculate total income for the date
  const incomeResult = await Income.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: "$amount" },
      },
    },
  ]);

  // Calculate total spending for the date
  const spendingResult = await Spending.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalSpending: { $sum: "$amount" },
      },
    },
  ]);

  const totalIncome = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;
  const totalSpending =
    spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;

  return {
    date: startDate.toISOString().split("T")[0],
    totalIncome,
    totalSpending,
  };
};

// Get monthly income and spending summary
const getIncomeSpendingByMonth = async (userId: string, month?: string) => {
  // Get user's custom month start date
  const user = await User.findById(userId).select("monthStartDate").lean();
  const monthStartDate = user?.monthStartDate || 1;

  let startDate: Date;
  let endDate: Date;

  if (month) {
    // Parse month in format "YYYY-MM" (e.g., "2026-01")
    const [year, monthNum] = month.split("-").map(Number);

    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid month format. Use YYYY-MM (e.g., 2026-01)",
      );
    }

    // Use custom start date for specified month (UTC)
    startDate = new Date(
      Date.UTC(year, monthNum - 1, monthStartDate, 0, 0, 0, 0),
    );
    endDate = new Date(
      Date.UTC(year, monthNum, monthStartDate - 1, 23, 59, 59, 999),
    );
  } else {
    // Use current cycle based on user's custom start date (UTC)
    const now = new Date();
    const currentDay = now.getUTCDate();

    if (currentDay >= monthStartDate) {
      // Current cycle: starts this month
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
      // Current cycle: started last month
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

  // Calculate total income for the month
  const incomeResult = await Income.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: "$amount" },
      },
    },
  ]);

  // Calculate total spending for the month
  const spendingResult = await Spending.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalSpending: { $sum: "$amount" },
      },
    },
  ]);

  const totalIncome = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;
  const totalSpending =
    spendingResult.length > 0 ? spendingResult[0].totalSpending : 0;

  return {
    totalIncome,
    totalSpending,
  };
};

const getCurrentBalance = async (userId: string) => {
  const accounts = await Balance.find({
    userId,
  })
    .select("amount")
    .lean();

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.amount,
    0,
  );

  return totalBalance;
};

export const balanceService = {
  createAccount,
  getTotalAccount,
  updateAccount,
  deleteAccount,
  addIncomeToAccount,
  addSpendingToAccount,
  getIncomeSpendingByDate,
  getIncomeSpendingByMonth,
  getCurrentBalance,
};
