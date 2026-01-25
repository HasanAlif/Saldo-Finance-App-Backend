import mongoose, { Document, Schema } from "mongoose";

export interface IBalance extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  name: string;
  amount: number;
  currency: string;
  creditLimit?: number;
  lastUpdated?: Date;
  icon?: string;
  accountType?: string;
  color?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BalanceSchema = new Schema<IBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    creditLimit: {
      type: Number,
    },
    lastUpdated: {
      type: Date,
    },
    icon: {
      type: String,
    },
    accountType: {
      type: String,
    },
    color: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
BalanceSchema.index({ userId: 1, createdAt: -1 });
BalanceSchema.index({ userId: 1, isDeleted: 1 });

export const Balance = mongoose.model<IBalance>("Balance", BalanceSchema);
