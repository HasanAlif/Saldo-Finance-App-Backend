import { z } from "zod";

const createSchema = z
  .object({
    name: z
      .string({
        required_error: "Name is required",
      })
      .min(1, "Name cannot be empty")
      .max(100, "Name cannot exceed 100 characters")
      .trim(),
    amount: z
      .number({
        required_error: "Amount is required",
        invalid_type_error: "Amount must be a number",
      })
      .min(0.01, "Amount must be greater than 0"),
    accumulatedAmount: z
      .number({
        invalid_type_error: "Accumulated amount must be a number",
      })
      .min(0, "Accumulated amount cannot be negative")
      .optional(),
    lender: z
      .string()
      .max(100, "Lender name cannot exceed 100 characters")
      .trim()
      .optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    debtDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid debt date format",
      })
      .optional(),
    payoffDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid payoff date format",
      })
      .optional(),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .refine(
    (data) => {
      if (data.debtDate && data.payoffDate) {
        return new Date(data.debtDate) <= new Date(data.payoffDate);
      }
      return true;
    },
    {
      message: "Debt date cannot be after payoff date",
      path: ["debtDate"],
    },
  );

const updateSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name cannot be empty")
      .max(100, "Name cannot exceed 100 characters")
      .trim()
      .optional(),
    amount: z
      .number({
        invalid_type_error: "Amount must be a number",
      })
      .min(0.01, "Amount must be greater than 0")
      .optional(),
    accumulatedAmount: z
      .number({
        invalid_type_error: "Accumulated amount must be a number",
      })
      .min(0, "Accumulated amount cannot be negative")
      .optional(),
    lender: z
      .string()
      .max(100, "Lender name cannot exceed 100 characters")
      .trim()
      .optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    debtDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid debt date format",
      })
      .optional(),
    payoffDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid payoff date format",
      })
      .optional(),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
  })
  .refine(
    (data) => {
      if (data.debtDate && data.payoffDate) {
        return new Date(data.debtDate) <= new Date(data.payoffDate);
      }
      return true;
    },
    {
      message: "Debt date cannot be after payoff date",
      path: ["debtDate"],
    },
  );

const addPaymentSchema = z.object({
  amount: z
    .number({
      required_error: "Amount is required",
      invalid_type_error: "Amount must be a number",
    })
    .positive("Amount must be greater than 0"),
});

export const borrowedValidation = {
  createSchema,
  updateSchema,
  addPaymentSchema,
};
