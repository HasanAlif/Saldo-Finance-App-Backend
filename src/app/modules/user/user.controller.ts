import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import pick from "../../../shared/pick";
import sendResponse from "../../../shared/sendResponse";
import { userFilterableFields } from "./user.costant";
import { userService } from "./user.service";

// Register new user
const createUser = catchAsync(async (req: Request, res: Response) => {
  const { fullName, email, mobileNumber, password, fcmToken, timezone } =
    req.body;
  const result = await userService.createUserIntoDb({
    fullName,
    email,
    mobileNumber,
    password,
    fcmToken,
    timezone,
  });

  // Set token in cookie
  res.cookie("token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully!",
    data: result,
  });
});

// Get all users
const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);

  const result = await userService.getUsersFromDb(filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

// Update profile
const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.updateProfile(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully!",
    data: result,
  });
});

// Update user (Admin)
const updateUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.updateUserIntoDb(req.body, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User updated successfully!",
    data: result,
  });
});

// Update profile image
const profileImageChange = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.profileImageChange(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image updated successfully!",
    data: result,
  });
});

// Update account
const accountUpdate = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.accountUpdateIntoDb(req.body, req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account updated successfully!",
    data: result,
  });
});

// Delete account
const deleteMe = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteUserFromDb(req.user.id);

  res.clearCookie("token");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted successfully!",
    data: result,
  });
});

// Setup user profile (country, currency, language)
const setupProfile = catchAsync(async (req: Request, res: Response) => {
  const { country, currency, language, timezone } = req.body;
  const result = await userService.userProfileSetup(req.user.id, {
    country,
    currency,
    language,
    timezone,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile setup completed successfully!",
    data: result,
  });
});

export const userController = {
  createUser,
  getUsers,
  updateProfile,
  updateUser,
  accountUpdate,
  deleteMe,
  profileImageChange,
  setupProfile,
};
