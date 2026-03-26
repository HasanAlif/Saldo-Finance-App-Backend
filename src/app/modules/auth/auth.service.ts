import * as bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import emailSender from "../../../shared/emailSender";
import { PASSWORD_RESET_TEMPLATE } from "../../../utils/Template";
import { AuthProvider, User } from "../../models";

// User login
const loginUser = async (payload: {
  email: string;
  password: string;
  fcmToken?: string;
}) => {
  const userData = await User.findOne({ email: payload.email })
    .select("+password")
    .lean();

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "Invalid email or password");
  }

  if (userData.status === "BLOCKED") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your account has been blocked");
  }

  // Check if user is Google-only (no password)
  if (!userData.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This account uses Google sign-in. Please continue with Google.",
    );
  }

  const isPasswordValid = await bcrypt.compare(
    payload.password,
    userData.password,
  );
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  // Update FCM token if provided
  if (payload.fcmToken) {
    await User.findByIdAndUpdate(userData._id, { fcmToken: payload.fcmToken });
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: userData._id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const {
    password,
    resetPasswordOtp,
    resetPasswordOtpExpiry,
    ...userWithoutSensitive
  } = userData;

  return { token: accessToken, user: userWithoutSensitive };
};

// Get user profile
const getMyProfile = async (userId: string) => {
  const userProfile = await User.findById(userId)
    .select(
      "_id fullName email mobileNumber profilePicture role status premiumPlan premiumPlanExpiry isEnjoyedTrial country countryCode currency language timezone monthStartDate createdAt",
    )
    .lean();

  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return {
    _id: userProfile._id,
    fullName: userProfile.fullName,
    email: userProfile.email,
    mobileNumber: userProfile.mobileNumber ?? null,
    profilePicture: userProfile.profilePicture ?? null,
    role: userProfile.role,
    status: userProfile.status,
    premiumPlan: userProfile.premiumPlan ?? null,
    premiumPlanExpiry: userProfile.premiumPlanExpiry ?? null,
    isEnjoyedTrial: userProfile.isEnjoyedTrial ?? false,
    country: userProfile.country ?? null,
    countryCode: userProfile.countryCode ?? null,
    currency: userProfile.currency ?? null,
    language: userProfile.language ?? null,
    timezone: userProfile.timezone ?? null,
    monthStartDate: userProfile.monthStartDate ?? null,
    createdAt: userProfile.createdAt,
  };
};

// Change password
const changePassword = async (
  userId: string,
  newPassword: string,
  oldPassword: string,
) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Check if user has a password (Google users might not)
  if (!user.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for Google sign-in accounts. Please set a password first.",
    );
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  return { message: "Password changed successfully" };
};

// Forgot password - Send OTP
const forgotPassword = async (payload: { email: string }) => {
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await User.findByIdAndUpdate(user._id, {
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: otpExpiry,
  });

  await emailSender(
    payload.email,
    PASSWORD_RESET_TEMPLATE(otp),
    "Password Reset OTP - Saldo",
  );

  return { message: "OTP sent to your email", otp }; // Return OTP for testing purposes only
};

// Resend OTP
const resendOtp = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await User.findByIdAndUpdate(user._id, {
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: otpExpiry,
  });

  await emailSender(
    email,
    PASSWORD_RESET_TEMPLATE(otp),
    "Password Reset OTP - Saldo",
  );

  return { message: "OTP resent to your email", otp }; // Return OTP for testing purposes only
};

// Verify OTP
const verifyForgotPasswordOtp = async (payload: {
  email: string;
  otp: string;
}) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+resetPasswordOtp +resetPasswordOtpExpiry",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== payload.otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  return { message: "OTP verified successfully", isValid: true };
};

// Reset password
const resetPassword = async (
  email: string,
  newPassword: string,
  confirmPassword: string,
  otp: string,
) => {
  if (newPassword !== confirmPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Passwords do not match");
  }

  const user = await User.findOne({ email }).select(
    "+resetPasswordOtp +resetPasswordOtpExpiry",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findByIdAndUpdate(user._id, {
    password: hashedPassword,
    resetPasswordOtp: undefined,
    resetPasswordOtpExpiry: undefined,
  });

  return { message: "Password reset successfully" };
};

// Social Login (Google, etc.)
const socialLogin = async (payload: {
  email: string;
  name: string;
  profileImage?: string;
  provider: AuthProvider;
  providerId: string;
}) => {
  const { email, name, profileImage, provider, providerId } = payload;

  let user = await User.findOne({ email }).lean();

  if (user) {
    // User exists - check if linking is needed
    if (user.authProvider === AuthProvider.LOCAL) {
      // Link Google account to existing LOCAL user
      await User.findByIdAndUpdate(user._id, {
        googleId: providerId,
        authProvider: provider,
        profilePicture: user.profilePicture || profileImage,
      });
      user = await User.findById(user._id).lean();
    } else if (user.googleId && user.googleId !== providerId) {
      // Different Google account trying to use same email
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This email is already registered with a different Google account",
      );
    }
  } else {
    // Create new user
    const newUser = await User.create({
      fullName: name,
      email,
      googleId: providerId,
      profilePicture: profileImage,
      authProvider: provider,
    });
    user = await User.findById(newUser._id).lean();
  }

  if (!user) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create or retrieve user",
    );
  }

  if (user.status === "BLOCKED") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your account has been blocked");
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const {
    password,
    resetPasswordOtp,
    resetPasswordOtpExpiry,
    ...userWithoutSensitive
  } = user as any;

  return { token: accessToken, user: userWithoutSensitive };
};

export const authService = {
  loginUser,
  getMyProfile,
  changePassword,
  forgotPassword,
  resendOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  socialLogin,
};
