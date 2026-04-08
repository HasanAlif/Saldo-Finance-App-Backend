import { z } from "zod";

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

const CreateUserValidationSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100),
    email: z.string().email("Please provide a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
    mobileNumber: z.string().optional(),
    fcmToken: optionalPushTokenSchema,
    deviceId: z.string().optional(),
    deviceType: z
      .enum(["ios", "android", "web"], {
        errorMap: () => ({
          message: "Device type must be ios, android, or web",
        }),
      })
      .or(z.literal(""))
      .optional(),
    deviceName: z.string().max(100).optional(),
    timezone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const UserLoginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
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

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  mobileNumber: z.string().min(10).optional(),
});

const UserProfileSetupSchema = z.object({
  country: z.string().min(1, "Country is required"),
  currency: z.string().optional(),
  language: z.string().min(1, "Language is required"),
  timezone: z.string().optional(),
});

export const UserValidation = {
  CreateUserValidationSchema,
  UserLoginValidationSchema,
  UpdateProfileSchema,
  UserProfileSetupSchema,
};
