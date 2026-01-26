import { z } from "zod";

const createSchema = z.object({
  category: z.string().min(1, "Category is required"),
  budgetValue: z.number().min(0.01, "Budget value must be greater than 0"),
  currency: z.string().min(1, "Currency is required"),
  status: z.enum(["WEEKLY", "MONTHLY"], {
    errorMap: () => ({ message: "Status must be WEEKLY or MONTHLY" }),
  }),
});

const updateSchema = z.object({
  category: z.string().min(1).optional(),
  budgetValue: z.number().min(0.01).optional(),
  currency: z.string().min(1).optional(),
  status: z.enum(["WEEKLY", "MONTHLY"]).optional(),
});

export const budgetValidation = {
  createSchema,
  updateSchema,
};
