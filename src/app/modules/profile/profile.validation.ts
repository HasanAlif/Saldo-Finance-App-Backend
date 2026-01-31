import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name cannot be empty").optional(),
  mobileNumber: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
});

export const profileValidation = {
  updateProfileSchema,
};
