import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";
import { User, PremiumPlan } from "../models";

const requirePremium = async (
  req: Request & { user?: JwtPayload },
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.id) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    const user = await User.findById(req.user.id).select("premiumPlan").lean();

    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
    }

    const validPremiumPlans = [
      PremiumPlan.TRIAL,
      PremiumPlan.ANNUAL,
      PremiumPlan.MONTHLY,
      PremiumPlan.LIFETIME,
    ];

    if (!user.premiumPlan || !validPremiumPlans.includes(user.premiumPlan)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Please upgrade to a premium plan to access this feature",
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default requirePremium;
