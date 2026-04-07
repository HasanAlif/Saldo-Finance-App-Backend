import { z } from "zod";

const expoTokenRegex = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const fcmTokenRegex = /^[A-Za-z0-9:_-]{40,}$/;

const pushTokenSchema = z
  .string()
  .trim()
  .refine(
    (token) => expoTokenRegex.test(token) || fcmTokenRegex.test(token),
    "Invalid push token format",
  );

const registerTokenSchema = z.object({
  fcmToken: pushTokenSchema,
  deviceId: z.string().min(1, "Device ID is required"),
  deviceType: z.enum(["ios", "android", "web"], {
    errorMap: () => ({ message: "Device type must be ios, android, or web" }),
  }),
  deviceName: z.string().max(100).optional(),
});

const deleteTokenSchema = z
  .object({
    body: z
      .object({
        deviceId: z.string().optional(),
      })
      .optional(),
    query: z
      .object({
        deviceId: z.string().optional(),
      })
      .optional(),
  })
  .refine((data) => data.body?.deviceId || data.query?.deviceId, {
    message: "Device ID is required in body or query",
  });

export const fcmTokenValidation = {
  registerTokenSchema,
  deleteTokenSchema,
};
