import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import config from "../../config";
import ApiError from "../../errors/ApiErrors";
import { jwtHelpers } from "../../helpars/jwtHelpers";
import { User } from "../models";

const extractToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  if (req.headers["x-auth-token"]) {
    return req.headers["x-auth-token"] as string;
  }

  return undefined;
};

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: JwtPayload },
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const token = extractToken(req);

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required");
      }

      const decoded = jwtHelpers.verifyToken(
        token,
        config.jwt.jwt_secret as string,
      );

      const user = await User.findById(decoded.id).select("role").lean();

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
      }

      if (roles.length && !roles.includes(decoded.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
      }

      req.user = decoded;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default auth;
