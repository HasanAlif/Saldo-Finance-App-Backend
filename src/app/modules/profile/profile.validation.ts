import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name cannot be empty").optional(),
  mobileNumber: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
});

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileValidation = {
  updateProfileSchema,
  changePasswordSchema,
};
