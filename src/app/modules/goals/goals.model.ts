import mongoose, { Document, Schema, Types } from "mongoose";

export interface IGoals extends Document {
  _id: string;
  userId: Types.ObjectId;
  name: string;
  targetAmount: number;
  currency?: string;
  category: string;
  accumulatedAmount: number;
  status: "IN_PROGRESS" | "COMPLETED";
  icon?: string;
  color?: string;
  date?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GoalsSchema = new Schema<IGoals>(
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
    targetAmount: {
      type: Number,
      required: true,
      min: [0.01, "Target amount must be greater than 0"],
    },
    currency: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    accumulatedAmount: {
      type: Number,
      default: 0,
      min: [0, "Accumulated amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED"],
      default: "IN_PROGRESS",
    },
    icon: {
      type: String,
    },
    color: {
      type: String,
    },
    date: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
GoalsSchema.index({ userId: 1, status: 1 });
GoalsSchema.index({ userId: 1, createdAt: -1 });

export const Goals = mongoose.model<IGoals>("Goals", GoalsSchema);
