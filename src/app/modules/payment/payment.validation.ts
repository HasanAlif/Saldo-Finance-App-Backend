import { z } from "zod";

const createCheckoutSessionSchema = z.object({
  plan: z.enum(["MONTHLY", "ANNUAL", "LIFETIME"], {
    required_error: "Plan is required",
    invalid_type_error: "Plan must be MONTHLY, ANNUAL, or LIFETIME",
  }),
});

export const paymentValidation = {
  createCheckoutSessionSchema,
};
