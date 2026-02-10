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
      .max(100, "Borrower name cannot exceed 100 characters")
      .trim()
      .optional(),
    currency: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    lentDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid lent date format",
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
      if (data.lentDate && data.payoffDate) {
        return new Date(data.lentDate) <= new Date(data.payoffDate);
      }
      return true;
    },
    {
      message: "Lent date cannot be after payoff date",
      path: ["lentDate"],
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
      .max(100, "Borrower name cannot exceed 100 characters")
      .trim()
      .optional(),
    currency: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    lentDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid lent date format",
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
      if (data.lentDate && data.payoffDate) {
        return new Date(data.lentDate) <= new Date(data.payoffDate);
      }
      return true;
    },
    {
      message: "Lent date cannot be after payoff date",
      path: ["lentDate"],
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

export const lentValidation = {
  createSchema,
  updateSchema,
  addPaymentSchema,
};
