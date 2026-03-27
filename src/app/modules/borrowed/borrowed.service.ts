import mongoose from "mongoose";
import { Borrowed, IBorrowed } from "./borrowed.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { Balance } from "../balance/balance.model";

const BORROWED_ACCUMULATED_LIMIT_ERROR =
  "Accumulated ammount cannot be bigger than Borrowed amount.";
const BORROWED_INSUFFICIENT_FUNDS_ERROR =
  "In This Account doesn't have enough funds to complete this transaction.";

const getBorrowedNetBalanceEffect = (
  amount: number,
  accumulatedAmount: number,
): number => amount - accumulatedAmount;

const ensureBorrowedAccumulatedWithinAmount = (
  amount: number,
  accumulatedAmount: number,
) => {
  if (accumulatedAmount > amount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      BORROWED_ACCUMULATED_LIMIT_ERROR,
    );
  }
};

const getBorrowedStatus = (
  amount: number,
  accumulatedAmount: number,
): "UNPAID" | "PAID" => (accumulatedAmount >= amount ? "PAID" : "UNPAID");

const runInTransaction = async <T>(
  operation: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const applyBorrowedBalanceDelta = async (
  session: mongoose.ClientSession,
  userId: string,
  accountId: mongoose.Types.ObjectId,
  delta: number,
) => {
  if (delta === 0) {
    return;
  }

  const result = await Balance.updateOne(
    { _id: accountId, userId },
    {
      $inc: { amount: delta },
      $set: { lastUpdated: new Date() },
    },
    { session },
  );

  if (result.matchedCount === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
  }
};

const ensureBorrowedAccountHasSufficientFunds = async (
  session: mongoose.ClientSession,
  userId: string,
  accountId: mongoose.Types.ObjectId,
  delta: number,
) => {
  if (delta >= 0) {
    return;
  }

  const account = await Balance.findOne({
    _id: accountId,
    userId,
  })
    .select("amount")
    .session(session)
    .lean();

  if (!account) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
  }

  if (account.amount + delta < 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      BORROWED_INSUFFICIENT_FUNDS_ERROR,
    );
  }
};

const getBorrowedAccountId = (borrowed: IBorrowed): mongoose.Types.ObjectId => {
  if (!borrowed.accountId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Borrowed record account is missing. Please recreate this record.",
    );
  }

  return borrowed.accountId;
};

const createBorrowed = async (
  userId: string,
  payload: Partial<IBorrowed>,
): Promise<IBorrowed> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  if (
    !payload.accountId ||
    !mongoose.Types.ObjectId.isValid(payload.accountId)
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid account ID");
  }

  const amount = payload.amount;
  if (typeof amount !== "number" || amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Amount must be greater than 0");
  }

  const accumulatedAmount = payload.accumulatedAmount ?? 0;
  ensureBorrowedAccumulatedWithinAmount(amount, accumulatedAmount);

  const status = getBorrowedStatus(amount, accumulatedAmount);
  const accountObjectId = new mongoose.Types.ObjectId(payload.accountId);

  const result = await runInTransaction(async (session) => {
    const account = await Balance.findOne({
      _id: accountObjectId,
      userId,
    })
      .select("_id")
      .session(session)
      .lean();

    if (!account) {
      throw new ApiError(httpStatus.NOT_FOUND, "Account not found");
    }

    const created = await Borrowed.create(
      [
        {
          ...payload,
          userId,
          accountId: accountObjectId,
          amount,
          accumulatedAmount,
          status,
        },
      ],
      { session },
    );

    await applyBorrowedBalanceDelta(
      session,
      userId,
      accountObjectId,
      getBorrowedNetBalanceEffect(amount, accumulatedAmount),
    );

    return created[0];
  });

  return result;
};

const getAllBorrowed = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const borrowedList = await Borrowed.find({ userId })
    .sort({ createdAt: -1 })
    .lean();

  const borrowedWithProgress = borrowedList.map((item) => {
    const amountLeft = Math.max(0, item.amount - item.accumulatedAmount);
    const paymentPercentage = Math.min(
      100,
      Math.round((item.accumulatedAmount / item.amount) * 100),
    );

    return {
      id: item._id,
      name: item.name,
      icon: item.icon || null,
      notes: item.notes || null,
      amount: item.amount,
      accumulatedAmount: item.accumulatedAmount,
      amountLeft,
      paymentPercentage,
    };
  });

  const totalBorrowed = borrowedList.length;
  const paidCount = borrowedList.filter(
    (item) => item.status === "PAID",
  ).length;

  const totalDebtLeft = borrowedWithProgress.reduce(
    (sum, item) => sum + item.amountLeft,
    0,
  );

  return {
    totalDebtLeft,
    paidOff: `${paidCount}/${totalBorrowed}`,
    borrowed: borrowedWithProgress,
  };
};

const getBorrowedById = async (
  userId: string,
  borrowedId: string,
): Promise<{
  id: unknown;
  name: string;
  notes: string | null;
  accumulatedAmount: number;
  total: number;
  lentDate: Date | null;
  lender: string | null;
  payoffDate: Date | null;
}> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(borrowedId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid borrowed ID");
  }

  const result = await Borrowed.findOne({
    _id: borrowedId,
    userId,
  }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
  }

  const response = {
    id: result._id,
    name: result.name,
    notes: result.notes || null,
    accumulatedAmount: result.accumulatedAmount,
    total: result.amount,
    lentDate: result.debtDate || null,
    lender: result.lender || null,
    payoffDate: result.payoffDate || null,
  };

  return response;
};

const updateBorrowed = async (
  userId: string,
  borrowedId: string,
  payload: Partial<IBorrowed>,
): Promise<IBorrowed | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(borrowedId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid borrowed ID");
  }

  const result = await runInTransaction(async (session) => {
    const borrowed = await Borrowed.findOne({
      _id: borrowedId,
      userId,
    }).session(session);

    if (!borrowed) {
      throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
    }

    const accountId = getBorrowedAccountId(borrowed);
    const oldNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    if (payload.amount !== undefined) {
      if (typeof payload.amount !== "number" || payload.amount <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Amount must be greater than 0",
        );
      }

      borrowed.amount = payload.amount;
    }

    if (payload.accumulatedAmount !== undefined) {
      if (payload.accumulatedAmount < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Accumulated amount cannot be negative",
        );
      }

      borrowed.accumulatedAmount = payload.accumulatedAmount;
    }

    ensureBorrowedAccumulatedWithinAmount(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    if (payload.name !== undefined) borrowed.name = payload.name;
    if (payload.notes !== undefined) borrowed.notes = payload.notes;
    if (payload.icon !== undefined) borrowed.icon = payload.icon;
    if (payload.color !== undefined) borrowed.color = payload.color;
    if (payload.currency !== undefined) borrowed.currency = payload.currency;
    if (payload.lender !== undefined) borrowed.lender = payload.lender;
    if (payload.debtDate !== undefined) borrowed.debtDate = payload.debtDate;
    if (payload.payoffDate !== undefined)
      borrowed.payoffDate = payload.payoffDate;

    borrowed.status = getBorrowedStatus(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    const newNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );
    const delta = newNetEffect - oldNetEffect;

    await ensureBorrowedAccountHasSufficientFunds(
      session,
      userId,
      accountId,
      delta,
    );

    await borrowed.save({ session });

    await applyBorrowedBalanceDelta(session, userId, accountId, delta);

    return borrowed;
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
  }

  return result;
};

const deleteBorrowed = async (
  userId: string,
  borrowedId: string,
): Promise<IBorrowed | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(borrowedId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid borrowed ID");
  }

  const result = await runInTransaction(async (session) => {
    const borrowed = await Borrowed.findOne({
      _id: borrowedId,
      userId,
    }).session(session);

    if (!borrowed) {
      throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
    }

    const accountId = getBorrowedAccountId(borrowed);
    const oldNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );
    const delta = -oldNetEffect;

    await ensureBorrowedAccountHasSufficientFunds(
      session,
      userId,
      accountId,
      delta,
    );

    await borrowed.deleteOne({ session });

    await applyBorrowedBalanceDelta(session, userId, accountId, delta);

    return borrowed;
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
  }

  return result;
};

const addPayment = async (
  userId: string,
  borrowedId: string,
  amount: number,
  accountId?: string,
): Promise<IBorrowed | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(borrowedId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid borrowed ID");
  }
  if (amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Amount must be greater than 0");
  }

  const result = await runInTransaction(async (session) => {
    const borrowed = await Borrowed.findOne({
      _id: borrowedId,
      userId,
    }).session(session);

    if (!borrowed) {
      throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
    }

    if (borrowed.status === "PAID") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This debt is already fully paid",
      );
    }

    let deductionAccountId: mongoose.Types.ObjectId;

    if (accountId) {
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid account ID");
      }

      deductionAccountId = new mongoose.Types.ObjectId(accountId);
    } else {
      deductionAccountId = getBorrowedAccountId(borrowed);
    }

    const oldNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    borrowed.accumulatedAmount += amount;
    ensureBorrowedAccumulatedWithinAmount(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );
    borrowed.status = getBorrowedStatus(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    const newNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );
    const delta = newNetEffect - oldNetEffect;

    await ensureBorrowedAccountHasSufficientFunds(
      session,
      userId,
      deductionAccountId,
      delta,
    );

    await borrowed.save({ session });

    await applyBorrowedBalanceDelta(session, userId, deductionAccountId, delta);

    return borrowed;
  });

  return result;
};

const markAsPaid = async (
  userId: string,
  borrowedId: string,
): Promise<IBorrowed | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(borrowedId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid borrowed ID");
  }

  const result = await runInTransaction(async (session) => {
    const borrowed = await Borrowed.findOne({
      _id: borrowedId,
      userId,
    }).session(session);

    if (!borrowed) {
      throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
    }

    if (borrowed.status === "PAID") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This debt is already fully paid",
      );
    }

    const accountId = getBorrowedAccountId(borrowed);
    const oldNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );

    borrowed.accumulatedAmount = borrowed.amount;
    borrowed.status = "PAID";

    const newNetEffect = getBorrowedNetBalanceEffect(
      borrowed.amount,
      borrowed.accumulatedAmount,
    );
    const delta = newNetEffect - oldNetEffect;

    await ensureBorrowedAccountHasSufficientFunds(
      session,
      userId,
      accountId,
      delta,
    );

    await borrowed.save({ session });

    await applyBorrowedBalanceDelta(session, userId, accountId, delta);

    return borrowed;
  });

  return result;
};

export const borrowedService = {
  createBorrowed,
  getAllBorrowed,
  getBorrowedById,
  updateBorrowed,
  deleteBorrowed,
  addPayment,
  markAsPaid,
};
