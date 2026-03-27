import mongoose from "mongoose";
import { Lent, ILent } from "./lent.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { Balance } from "../balance/balance.model";

const LENT_ACCUMULATED_LIMIT_ERROR =
  "Accumulated ammount cannot be bigger than Lent amount.";
const LENT_INSUFFICIENT_FUNDS_ERROR =
  "In This Account doesn't have enough funds to complete this transaction.";

const getLentNetBalanceEffect = (
  amount: number,
  accumulatedAmount: number,
): number => accumulatedAmount - amount;

const ensureLentAccumulatedWithinAmount = (
  amount: number,
  accumulatedAmount: number,
) => {
  if (accumulatedAmount > amount) {
    throw new ApiError(httpStatus.BAD_REQUEST, LENT_ACCUMULATED_LIMIT_ERROR);
  }
};

const getLentStatus = (
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

const applyLentBalanceDelta = async (
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

const ensureLentAccountHasSufficientFunds = async (
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
    throw new ApiError(httpStatus.BAD_REQUEST, LENT_INSUFFICIENT_FUNDS_ERROR);
  }
};

const getLentAccountId = (lent: ILent): mongoose.Types.ObjectId => {
  if (!lent.accountId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Lent record account is missing. Please recreate this record.",
    );
  }

  return lent.accountId;
};

const createLent = async (
  userId: string,
  payload: Partial<ILent>,
): Promise<ILent> => {
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
  ensureLentAccumulatedWithinAmount(amount, accumulatedAmount);

  const status = getLentStatus(amount, accumulatedAmount);
  const accountObjectId = new mongoose.Types.ObjectId(payload.accountId);

  const result = await runInTransaction(async (session) => {
    const delta = getLentNetBalanceEffect(amount, accumulatedAmount);
    await ensureLentAccountHasSufficientFunds(
      session,
      userId,
      accountObjectId,
      delta,
    );

    const created = await Lent.create(
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

    await applyLentBalanceDelta(session, userId, accountObjectId, delta);

    return created[0];
  });

  return result;
};

const getAllLent = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const lentList = await Lent.find({ userId }).sort({ createdAt: -1 }).lean();

  const lentWithProgress = lentList.map((item) => {
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
      lender: item.lender || null,
      amount: item.amount,
      accumulatedAmount: item.accumulatedAmount,
      amountLeft,
      paymentPercentage,
    };
  });

  const totalLent = lentList.length;
  const paidCount = lentList.filter((item) => item.status === "PAID").length;

  const totalReceivableLeft = lentWithProgress.reduce(
    (sum, item) => sum + item.amountLeft,
    0,
  );

  return {
    totalReceivableLeft,
    collected: `${paidCount}/${totalLent}`,
    lent: lentWithProgress,
  };
};

const getLentById = async (
  userId: string,
  lentId: string,
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
  if (!mongoose.Types.ObjectId.isValid(lentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid lent ID");
  }

  const result = await Lent.findOne({ _id: lentId, userId }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  return {
    id: result._id,
    name: result.name,
    notes: result.notes || null,
    accumulatedAmount: result.accumulatedAmount,
    total: result.amount,
    lentDate: result.lentDate || null,
    lender: result.lender || null,
    payoffDate: result.payoffDate || null,
  };
};

const updateLent = async (
  userId: string,
  lentId: string,
  payload: Partial<ILent>,
): Promise<ILent | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(lentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid lent ID");
  }

  const result = await runInTransaction(async (session) => {
    const lent = await Lent.findOne({
      _id: lentId,
      userId,
    }).session(session);

    if (!lent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
    }

    const accountId = getLentAccountId(lent);
    const oldNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    if (payload.amount !== undefined) {
      if (typeof payload.amount !== "number" || payload.amount <= 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Amount must be greater than 0",
        );
      }

      lent.amount = payload.amount;
    }

    if (payload.accumulatedAmount !== undefined) {
      if (payload.accumulatedAmount < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Accumulated amount cannot be negative",
        );
      }

      lent.accumulatedAmount = payload.accumulatedAmount;
    }

    ensureLentAccumulatedWithinAmount(lent.amount, lent.accumulatedAmount);

    if (payload.name !== undefined) lent.name = payload.name;
    if (payload.notes !== undefined) lent.notes = payload.notes;
    if (payload.icon !== undefined) lent.icon = payload.icon;
    if (payload.color !== undefined) lent.color = payload.color;
    if (payload.currency !== undefined) lent.currency = payload.currency;
    if (payload.lender !== undefined) lent.lender = payload.lender;
    if (payload.lentDate !== undefined) lent.lentDate = payload.lentDate;
    if (payload.payoffDate !== undefined) lent.payoffDate = payload.payoffDate;

    lent.status = getLentStatus(lent.amount, lent.accumulatedAmount);

    const newNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );
    const delta = newNetEffect - oldNetEffect;

    await ensureLentAccountHasSufficientFunds(
      session,
      userId,
      accountId,
      delta,
    );

    await lent.save({ session });

    await applyLentBalanceDelta(session, userId, accountId, delta);

    return lent;
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  return result;
};

const deleteLent = async (
  userId: string,
  lentId: string,
): Promise<ILent | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(lentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid lent ID");
  }

  const result = await runInTransaction(async (session) => {
    const lent = await Lent.findOne({ _id: lentId, userId }).session(session);

    if (!lent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
    }

    const accountId = getLentAccountId(lent);
    const oldNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    await lent.deleteOne({ session });

    await applyLentBalanceDelta(session, userId, accountId, -oldNetEffect);

    return lent;
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  return result;
};

const addPayment = async (
  userId: string,
  lentId: string,
  amount: number,
  accountId?: string,
): Promise<ILent | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(lentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid lent ID");
  }
  if (amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Amount must be greater than 0");
  }

  const result = await runInTransaction(async (session) => {
    const lent = await Lent.findOne({ _id: lentId, userId }).session(session);

    if (!lent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
    }

    if (lent.status === "PAID") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This lent amount is already fully collected",
      );
    }

    let targetAccountId: mongoose.Types.ObjectId;

    if (accountId) {
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid account ID");
      }

      targetAccountId = new mongoose.Types.ObjectId(accountId);
    } else {
      targetAccountId = getLentAccountId(lent);
    }

    const oldNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    lent.accumulatedAmount += amount;
    ensureLentAccumulatedWithinAmount(lent.amount, lent.accumulatedAmount);
    lent.status = getLentStatus(lent.amount, lent.accumulatedAmount);

    const newNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    await lent.save({ session });

    await applyLentBalanceDelta(
      session,
      userId,
      targetAccountId,
      newNetEffect - oldNetEffect,
    );

    return lent;
  });

  return result;
};

const markAsPaid = async (
  userId: string,
  lentId: string,
): Promise<ILent | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }
  if (!mongoose.Types.ObjectId.isValid(lentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid lent ID");
  }

  const result = await runInTransaction(async (session) => {
    const lent = await Lent.findOne({ _id: lentId, userId }).session(session);

    if (!lent) {
      throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
    }

    if (lent.status === "PAID") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This lent amount is already fully collected",
      );
    }

    const accountId = getLentAccountId(lent);
    const oldNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    lent.accumulatedAmount = lent.amount;
    lent.status = "PAID";

    const newNetEffect = getLentNetBalanceEffect(
      lent.amount,
      lent.accumulatedAmount,
    );

    await lent.save({ session });

    await applyLentBalanceDelta(
      session,
      userId,
      accountId,
      newNetEffect - oldNetEffect,
    );

    return lent;
  });

  return result;
};

export const lentService = {
  createLent,
  getAllLent,
  getLentById,
  updateLent,
  deleteLent,
  addPayment,
  markAsPaid,
};
