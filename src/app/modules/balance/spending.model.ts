import { Schema, model, Types } from "mongoose";

export interface ISpending {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  name: string;
  category: string;
  amount: number;
  currency: string;
  date: Date;
  time: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SpendingSchema = new Schema<ISpending>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Balance",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    time: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient queries
SpendingSchema.index({ userId: 1, date: -1 });
SpendingSchema.index({ accountId: 1, date: -1 });

export const Spending = model<ISpending>("Spending", SpendingSchema);
