import { z } from "zod";

const createSchema = z.object({
  name: z
    .string({
      required_error: "Name is required",
    })
    .min(1, "Name cannot be empty")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  targetAmount: z
    .number({
      required_error: "Target amount is required",
      invalid_type_error: "Target amount must be a number",
    })
    .min(0.01, "Target amount must be greater than 0"),
  currency: z.string().optional(),
  category: z
    .string({
      required_error: "Category is required",
    })
    .min(1, "Category cannot be empty")
    .max(50, "Category cannot exceed 50 characters")
    .trim(),
  accumulatedAmount: z
    .number({
      invalid_type_error: "Accumulated amount must be a number",
    })
    .min(0, "Accumulated amount cannot be negative")
    .optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    })
    .optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
});

const updateSchema = z.object({
  name: z
    .string()
    .min(1, "Name cannot be empty")
    .max(100, "Name cannot exceed 100 characters")
    .trim()
    .optional(),
  targetAmount: z
    .number({
      invalid_type_error: "Target amount must be a number",
    })
    .min(0.01, "Target amount must be greater than 0")
    .optional(),
  currency: z.string().optional(),
  category: z
    .string()
    .min(1, "Category cannot be empty")
    .max(50, "Category cannot exceed 50 characters")
    .trim()
    .optional(),
  accumulatedAmount: z
    .number({
      invalid_type_error: "Accumulated amount must be a number",
    })
    .min(0, "Accumulated amount cannot be negative")
    .optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    })
    .optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
});

const addProgressSchema = z.object({
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .positive("Amount must be greater than 0"),
});

export const goalsValidation = {
  createSchema,
  updateSchema,
  addProgressSchema,
};
