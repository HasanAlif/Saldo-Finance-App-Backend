import mongoose, { Document, Schema, Types } from "mongoose";

export interface IBorrowed extends Document {
  _id: string;
  userId: Types.ObjectId;
  name: string;
  notes?: string;
  icon?: string;
  color?: string;
  amount: number;
  currency?: string;
  accumulatedAmount: number;
  status: "UNPAID" | "PAID";
  lender?: string;
  debtDate?: Date;
  payoffDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BorrowedSchema = new Schema<IBorrowed>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    icon: {
      type: String,
    },
    color: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: {
      type: String,
      trim: true,
    },
    accumulatedAmount: {
      type: Number,
      default: 0,
      min: [0, "Accumulated amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID",
    },
    lender: {
      type: String,
      trim: true,
    },
    debtDate: {
      type: Date,
    },
    payoffDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
BorrowedSchema.index({ userId: 1, status: 1 });
BorrowedSchema.index({ userId: 1, createdAt: -1 });

export const Borrowed = mongoose.model<IBorrowed>("Borrowed", BorrowedSchema);
