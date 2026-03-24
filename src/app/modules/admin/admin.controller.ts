import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import { ContentType } from "./appContent.model";

const getContentTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    [ContentType.ABOUT_US]: "About Us",
    [ContentType.PRIVACY_POLICY]: "Privacy Policy",
    [ContentType.TERMS_AND_CONDITIONS]: "Terms and Conditions",
  };
  return typeNames[type] || type;
};

const createOrUpdateContent = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { content } = req.body;
  const result = await adminService.createOrUpdateContent(
    type as ContentType,
    content,
  );

  const contentTypeName = getContentTypeName(type);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${contentTypeName} updated successfully`,
    data: result,
  });
});

const getContentByType = catchAsync(async (req, res) => {
  const { type } = req.params;
  const result = await adminService.getContentByType(type as ContentType);

  const contentTypeName = getContentTypeName(type);
  const message = result._id
    ? `${contentTypeName} retrieved successfully`
    : `${contentTypeName} not yet created`;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message,
    data: result,
  });
});

const getUsersCount = catchAsync(async (req, res) => {
  const result = await adminService.getUsersCount();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users count retrieved successfully",
    data: result,
  });
});

const getMonthlyUserGrowth = catchAsync(async (req, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const result = await adminService.getMonthlyUserGrowth(year);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Monthly user growth retrieved successfully",
    data: result,
  });
});

const getMonthlyPremiumUsersGrowth = catchAsync(async (req, res) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const result = await adminService.getMonthlyPremiumUsersGrowth(year);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Monthly premium users growth retrieved successfully",
    data: result,
  });
});

export const adminController = {
  createOrUpdateContent,
  getContentByType,
  getUsersCount,
  getMonthlyUserGrowth,
  getMonthlyPremiumUsersGrowth,
};
