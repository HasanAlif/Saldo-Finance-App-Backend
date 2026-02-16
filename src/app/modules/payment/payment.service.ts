import mongoose from "mongoose";
import Stripe from "stripe";
import httpStatus from "http-status";
import { Payment, PaymentStatus } from "./payment.model";
import { User, PremiumPlan } from "../../models/User.model";
import ApiError from "../../../errors/ApiErrors";
import config from "../../../config";

const stripe = new Stripe(config.stripe.secret_key as string);

const PLAN_CONFIG = {
  MONTHLY: {
    price: 299,
    displayPrice: 2.99,
    currency: "eur",
    durationDays: 30,
    name: "Saldo Premium - Monthly",
  },
  ANNUAL: {
    price: 1999,
    displayPrice: 19.99,
    currency: "eur",
    durationDays: 365,
    name: "Saldo Premium - Annual",
  },
  LIFETIME: {
    price: 2999,
    displayPrice: 29.99,
    currency: "eur",
    durationDays: null as number | null,
    name: "Saldo Premium - Lifetime",
  },
} as const;

type PlanKey = keyof typeof PLAN_CONFIG;

const createCheckoutSession = async (userId: string, plan: PlanKey) => {
  const user = await User.findById(userId).select("email premiumPlan").lean();
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.premiumPlan === PremiumPlan.LIFETIME && plan === "LIFETIME") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You already have a Lifetime premium plan",
    );
  }

  const planConfig = PLAN_CONFIG[plan];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: planConfig.currency,
          product_data: {
            name: planConfig.name,
            description:
              plan === "LIFETIME"
                ? "Premium access forever"
                : `Premium access for ${planConfig.durationDays} days`,
          },
          unit_amount: planConfig.price,
        },
        quantity: 1,
      },
    ],
    customer_email: user.email,
    success_url: `${config.payment.success_url}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.payment.cancel_url as string,
    metadata: {
      userId: userId,
      plan: plan,
    },
  });

  await Payment.create({
    userId,
    stripeSessionId: session.id,
    plan: PremiumPlan[plan],
    amount: planConfig.displayPrice,
    currency: planConfig.currency,
    customerEmail: user.email,
    status: PaymentStatus.PENDING,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
};

const handleWebhookEvent = async (rawBody: Buffer, signature: string) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhook_secret as string,
    );
  } catch (err: any) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Webhook signature verification failed: ${err.message}`,
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await fulfillPayment(session);
  }

  return { received: true, type: event.type };
};

const fulfillPayment = async (session: Stripe.Checkout.Session) => {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as PlanKey | undefined;

  if (!userId || !plan) {
    console.error("[Payment] Webhook missing metadata:", session.id);
    return;
  }

  const existingPayment = await Payment.findOne({
    stripeSessionId: session.id,
    status: PaymentStatus.COMPLETED,
  });

  if (existingPayment) {
    return;
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const planConfig = PLAN_CONFIG[plan];
    let premiumPlanExpiry: Date | null = null;

    if (planConfig.durationDays !== null) {
      premiumPlanExpiry = new Date();
      premiumPlanExpiry.setDate(
        premiumPlanExpiry.getDate() + planConfig.durationDays,
      );
    }

    const updatedPayment = await Payment.findOneAndUpdate(
      {
        stripeSessionId: session.id,
        status: PaymentStatus.PENDING,
      },
      {
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: session.payment_intent as string,
        paidAt: new Date(),
      },
      { new: true, session: mongoSession },
    );

    if (!updatedPayment) {
      await mongoSession.abortTransaction();
      return;
    }

    await User.findByIdAndUpdate(
      userId,
      {
        premiumPlan: PremiumPlan[plan],
        premiumPlanExpiry: premiumPlanExpiry,
      },
      { session: mongoSession },
    );

    await mongoSession.commitTransaction();
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

const getCurrentPlan = async (userId: string) => {
  const user = await User.findById(userId)
    .select("premiumPlan premiumPlanExpiry")
    .lean();
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return {
    premiumPlan: user.premiumPlan,
    premiumPlanExpiry: user.premiumPlanExpiry,
  };
};

const activateTrialPlan = async (userId: string) => {
  const user = await User.findById(userId)
    .select("premiumPlan premiumPlanExpiry isEnjoyedTrial")
    .lean();

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isEnjoyedTrial) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You already enjoyed TRIAL plan. To enjoy Saldo Premium please buy a Plan",
    );
  }

  if (
    user.premiumPlan &&
    [PremiumPlan.MONTHLY, PremiumPlan.ANNUAL, PremiumPlan.LIFETIME].includes(
      user.premiumPlan,
    )
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You already have an active premium plan",
    );
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 7);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        premiumPlan: PremiumPlan.TRIAL,
        premiumPlanExpiry: trialExpiry,
        isEnjoyedTrial: true,
      },
      { new: true, session: mongoSession },
    ).select("premiumPlan premiumPlanExpiry isEnjoyedTrial");

    await mongoSession.commitTransaction();

    return {
      premiumPlan: updatedUser?.premiumPlan,
      premiumPlanExpiry: updatedUser?.premiumPlanExpiry,
      isEnjoyedTrial: updatedUser?.isEnjoyedTrial,
    };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
};

export const paymentService = {
  createCheckoutSession,
  handleWebhookEvent,
  getCurrentPlan,
  activateTrialPlan,
};
