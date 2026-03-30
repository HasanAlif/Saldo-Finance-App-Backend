import { z } from "zod";

const registerTokenSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
  deviceId: z.string().min(1, "Device ID is required"),
  deviceType: z.enum(["ios", "android", "web"], {
    errorMap: () => ({ message: "Device type must be ios, android, or web" }),
  }),
  deviceName: z.string().max(100).optional(),
});

const deleteTokenSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

export const fcmTokenValidation = {
  registerTokenSchema,
  deleteTokenSchema,
};
