import mongoose, { Document, Schema } from "mongoose";
import { PremiumPlan } from "../../models/User.model";

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export interface IPayment extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  plan: PremiumPlan;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customerEmail?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    plan: {
      type: String,
      enum: [PremiumPlan.MONTHLY, PremiumPlan.ANNUAL, PremiumPlan.LIFETIME],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "eur",
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    customerEmail: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
