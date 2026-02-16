import mongoose, { Document, Schema } from "mongoose";

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  BLOCKED = "BLOCKED",
}

export enum NotificationType {
  NORMAL = "NORMAL",
  URGENT = "URGENT",
  PROMOTIONAL = "PROMOTIONAL",
  SYSTEM = "SYSTEM",
}

export enum AuthProvider {
  LOCAL = "LOCAL",
  GOOGLE = "GOOGLE",
}

export enum PremiumPlan {
  TRIAL = "TRIAL",
  TRIAL_EXPIRED = "TRIAL_EXPIRED",
  ANNUAL = "ANNUAL",
  MONTHLY = "MONTHLY",
  LIFETIME = "LIFETIME",
}

export interface IUser extends Document {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber?: string;
  password?: string;
  profilePicture?: string;
  googleId?: string;
  authProvider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  premiumPlan?: PremiumPlan;
  premiumPlanExpiry?: Date | null;
  isEnjoyedTrial: boolean;
  isDeleted: boolean;
  fcmToken?: string;
  country?: string;
  currency?: string;
  language?: string;
  monthStartDate?: number;
  resetPasswordOtp?: string;
  resetPasswordOtpExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    profilePicture: {
      type: String,
    },
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    premiumPlan: {
      type: String,
      enum: Object.values(PremiumPlan),
      default: null,
    },
    premiumPlanExpiry: {
      type: Date,
      default: null,
    },
    isEnjoyedTrial: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
    },
    country: {
      type: String,
    },
    currency: {
      type: String,
    },
    language: {
      type: String,
    },
    monthStartDate: {
      type: Number,
      min: 1,
      max: 28,
      default: 1,
    },
    resetPasswordOtp: {
      type: String,
      select: false,
    },
    resetPasswordOtpExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance (email index created by unique: true)
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ mobileNumber: 1 });
UserSchema.index({ premiumPlan: 1, premiumPlanExpiry: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
