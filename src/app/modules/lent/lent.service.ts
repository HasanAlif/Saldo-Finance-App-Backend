import mongoose from "mongoose";
import { Lent, ILent } from "./lent.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";

const createLent = async (
  userId: string,
  payload: Partial<ILent>,
): Promise<ILent> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const result = await Lent.create({
    ...payload,
    userId,
    accumulatedAmount: payload.accumulatedAmount ?? 0,
    status: "UNPAID",
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

  const updateData = { ...payload };
  delete (updateData as any).userId;
  delete (updateData as any).status;
  delete (updateData as any)._id;

  const result = await Lent.findOneAndUpdate(
    { _id: lentId, userId },
    { $set: updateData },
    { new: true, runValidators: true },
  ).lean();

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

  const result = await Lent.findOneAndDelete({ _id: lentId, userId });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  return result;
};

const addPayment = async (
  userId: string,
  lentId: string,
  amount: number,
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

  const lent = await Lent.findOne({ _id: lentId, userId });

  if (!lent) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  if (lent.status === "PAID") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This lent amount is already fully collected",
    );
  }

  const newAccumulatedAmount = lent.accumulatedAmount + amount;

  if (newAccumulatedAmount > lent.amount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Adding ${amount} would exceed the lent amount. Maximum you can collect: ${
        lent.amount - lent.accumulatedAmount
      }`,
    );
  }

  lent.accumulatedAmount = newAccumulatedAmount;

  if (newAccumulatedAmount >= lent.amount) {
    lent.status = "PAID";
  }

  await lent.save();

  return lent.toObject();
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

  const lent = await Lent.findOne({ _id: lentId, userId });

  if (!lent) {
    throw new ApiError(httpStatus.NOT_FOUND, "Lent record not found");
  }

  if (lent.status === "PAID") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This lent amount is already fully collected",
    );
  }

  lent.status = "PAID";
  lent.accumulatedAmount = lent.amount;

  await lent.save();

  return lent.toObject();
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
