import { Schema, model, Types } from "mongoose";

export enum FillForYearTransactionType {
  INCOME = "INCOME",
  SPENDING = "SPENDING",
}

export interface IFillForYear {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  name: string;
  category: string;
  amount: number;
  year: number;
  type: FillForYearTransactionType;
  processedCycles: string[];
  lastProcessedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const FillForYearSchema = new Schema<IFillForYear>(
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
    year: {
      type: Number,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(FillForYearTransactionType),
      required: true,
      index: true,
    },
    processedCycles: {
      type: [String],
      default: [],
    },
    lastProcessedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

FillForYearSchema.index({ year: 1, userId: 1, type: 1 });
FillForYearSchema.index({ userId: 1, year: 1, accountId: 1, category: 1 });

export const FillForYear = model<IFillForYear>(
  "FillForYear",
  FillForYearSchema,
);
