import { z } from "zod";
import { AuthProvider } from "../../models";

const expoTokenRegex = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const fcmTokenRegex = /^[A-Za-z0-9:_-]{40,}$/;

const optionalPushTokenSchema = z
  .string()
  .trim()
  .refine(
    (token) =>
      token === "" || expoTokenRegex.test(token) || fcmTokenRegex.test(token),
    "Invalid push token format",
  )
  .optional();

const changePasswordValidationSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const resetPasswordValidationSchema = z
  .object({
    email: z.string().email("Please provide a valid email"),
    otp: z.string().length(6, "OTP must be 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const resendOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

const socialLoginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  name: z.string().min(1, "Name is required"),
  profileImage: z.string().optional(),
  provider: z.nativeEnum(AuthProvider),
  providerId: z.string().min(1, "Provider ID is required"),
  fcmToken: optionalPushTokenSchema,
  deviceId: z.string().optional(),
  deviceType: z
    .enum(["ios", "android", "web"], {
      errorMap: () => ({ message: "Device type must be ios, android, or web" }),
    })
    .or(z.literal(""))
    .optional(),
  deviceName: z.string().max(100).optional(),
});

export const authValidation = {
  changePasswordValidationSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordValidationSchema,
  resendOtpSchema,
  socialLoginValidationSchema,
};
