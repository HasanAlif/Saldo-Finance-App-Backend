import { z } from "zod";

const CreateAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  amount: z.number().min(0, "Amount cannot be negative"),
  currency: z.string().min(1, "Currency is required"),
  creditLimit: z.number().optional(),
  icon: z.string().optional(),
  accountType: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  creditLimit: z.number().optional(),
  icon: z.string().optional(),
  accountType: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const AccountValidation = {
  CreateAccountSchema,
  UpdateAccountSchema,
};
