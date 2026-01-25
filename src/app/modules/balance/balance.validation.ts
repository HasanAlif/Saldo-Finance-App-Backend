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

const AddIncomeSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().min(1, "Currency is required"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Time must be in HH:MM format",
  }),
  fillForAllYear: z.boolean().default(false),
});

export const AccountValidation = {
  CreateAccountSchema,
  UpdateAccountSchema,
  AddIncomeSchema,
};
