import mongoose from "mongoose";
import { Borrowed, IBorrowed } from "./borrowed.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";

const createBorrowed = async (
  userId: string,
  payload: Partial<IBorrowed>,
): Promise<IBorrowed> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const result = await Borrowed.create({
    ...payload,
    userId,
    accumulatedAmount: payload.accumulatedAmount ?? 0,
    status: "UNPAID",
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

  const updateData = { ...payload };
  delete (updateData as any).userId;
  delete (updateData as any).status;
  delete (updateData as any)._id;

  const result = await Borrowed.findOneAndUpdate(
    { _id: borrowedId, userId },
    { $set: updateData },
    { new: true, runValidators: true },
  ).lean();

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

  const result = await Borrowed.findOneAndDelete({
    _id: borrowedId,
    userId,
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

  const borrowed = await Borrowed.findOne({ _id: borrowedId, userId });

  if (!borrowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
  }

  if (borrowed.status === "PAID") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This debt is already fully paid",
    );
  }

  const newAccumulatedAmount = borrowed.accumulatedAmount + amount;

  if (newAccumulatedAmount > borrowed.amount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Adding ${amount} would exceed the debt amount. Maximum you can pay: ${
        borrowed.amount - borrowed.accumulatedAmount
      }`,
    );
  }

  borrowed.accumulatedAmount = newAccumulatedAmount;

  if (newAccumulatedAmount >= borrowed.amount) {
    borrowed.status = "PAID";
  }

  await borrowed.save();

  return borrowed.toObject();
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

  const borrowed = await Borrowed.findOne({ _id: borrowedId, userId });

  if (!borrowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "Borrowed record not found");
  }

  if (borrowed.status === "PAID") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This debt is already fully paid",
    );
  }

  borrowed.status = "PAID";
  borrowed.accumulatedAmount = borrowed.amount;

  await borrowed.save();

  return borrowed.toObject();
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
