import httpStatus from "http-status";
import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import { paginationHelper } from "../../../helpars/paginationHelper";
import { IPaginationOptions } from "../../../interfaces/paginations";
import { Balance, IBalance } from "./balance.model";
import { Income, IIncome } from "./income.model";

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

    return {
      income: income[0],
      account: updatedAccount,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const balanceService = {
  createAccount,
  getTotalAccount,
  updateAccount,
  deleteAccount,
  addIncomeToAccount,
};
