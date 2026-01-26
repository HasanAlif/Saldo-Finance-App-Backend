import mongoose, { Document, Schema, Types } from "mongoose";

export enum BudgetStatus {
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export interface IBudget extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  category: string;
  budgetValue: number;
  currency: string;
  status: BudgetStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    budgetValue: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    status: {
      type: String,
      enum: Object.values(BudgetStatus),
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for better performance
BudgetSchema.index({ userId: 1, category: 1 });
BudgetSchema.index({ userId: 1, status: 1 });

export const Budget = mongoose.model<IBudget>("Budget", BudgetSchema);
