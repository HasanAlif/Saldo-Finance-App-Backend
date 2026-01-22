import { User, IUser } from "../../models";
import * as bcrypt from "bcrypt";
import { Request } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { fileUploader } from "../../../helpars/fileUploader";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import { paginationHelper } from "../../../helpars/paginationHelper";
import { IPaginationOptions } from "../../../interfaces/paginations";
import { userSearchAbleFields } from "./user.costant";
import { IUserFilterRequest } from "./user.interface";

// Create a new user - Simple registration (fullName, email, mobileNumber, password)
const createUserIntoDb = async (payload: {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
}) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  // Check if mobile number already exists
  const existingMobile = await User.findOne({
    mobileNumber: payload.mobileNumber,
  });
  if (existingMobile) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this mobile number already exists",
    );
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds),
  );

  // Create user
  const createdUser = await User.create({
    fullName: payload.fullName,
    email: payload.email,
    mobileNumber: payload.mobileNumber,
    password: hashedPassword,
  });

  // Generate token
  const token = jwtHelpers.generateToken(
    {
      id: createdUser._id,
      email: createdUser.email,
      role: createdUser.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  return {
    user: {
      id: createdUser._id,
      fullName: createdUser.fullName,
      email: createdUser.email,
      mobileNumber: createdUser.mobileNumber,
      role: createdUser.role,
      createdAt: createdUser.createdAt,
    },
    token,
  };
};

// Get all users with search and pagination
const getUsersFromDb = async (
  params: IUserFilterRequest,
  options: IPaginationOptions,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;

  const andConditions: any[] = [{ isDeleted: false }];

  if (searchTerm) {
    andConditions.push({
      $or: userSearchAbleFields.map((field) => ({
        [field]: { $regex: searchTerm, $options: "i" },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      $and: Object.keys(filterData).map((key) => ({
        [key]: (filterData as any)[key],
      })),
    });
  }

  const whereConditions = { $and: andConditions };

  const sortConditions: Record<string, 1 | -1> = {};
  if (options.sortBy && options.sortOrder) {
    sortConditions[options.sortBy] = options.sortOrder === "desc" ? -1 : 1;
  } else {
    sortConditions.createdAt = -1;
  }

  const [result, total] = await Promise.all([
    User.find(whereConditions)
      .select(
        "_id fullName email mobileNumber profilePicture role status createdAt",
      )
      .sort(sortConditions)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(whereConditions),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: result,
  };
};

// Update user profile
const updateProfile = async (req: Request) => {
  const userId = req.user.id;
  const updateData: Record<string, any> = {};

  // Handle file upload
  if (req.file) {
    const uploaded = await fileUploader.uploadToCloudinary(
      req.file,
      "profile-images",
    );
    updateData.profilePicture = uploaded.Location;
  }

  // Handle JSON data
  if (req.body.data) {
    const parseData = JSON.parse(req.body.data);
    if (parseData.fullName) updateData.fullName = parseData.fullName;
    if (parseData.mobileNumber)
      updateData.mobileNumber = parseData.mobileNumber;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided for update");
  }

  const result = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    select: "_id fullName email mobileNumber profilePicture role",
  }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

// Update user by ID (Admin)
const updateUserIntoDb = async (payload: Partial<IUser>, id: string) => {
  const result = await User.findByIdAndUpdate(id, payload, {
    new: true,
    select: "_id fullName email mobileNumber profilePicture role status",
  }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

// Update profile image
const profileImageChange = async (req: Request) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No image provided");
  }

  const uploaded = await fileUploader.uploadToCloudinary(
    req.file,
    "profile-images",
  );

  const result = await User.findByIdAndUpdate(
    req.user.id,
    { profilePicture: uploaded.Location },
    { new: true, select: "_id fullName email profilePicture" },
  ).lean();

  return result;
};

// Soft delete user
const deleteUserFromDb = async (id: string) => {
  const result = await User.findByIdAndUpdate(
    id,
    { isDeleted: true, status: "INACTIVE" },
    { new: true, select: "_id fullName email status" },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

// Account update
const accountUpdateIntoDb = async (
  payload: Partial<IUser>,
  id: string,
): Promise<Partial<IUser> | null> => {
  const allowedFields = ["fullName", "mobileNumber"];
  const updateData: Record<string, any> = {};

  for (const key of allowedFields) {
    if ((payload as any)[key]) {
      updateData[key] = (payload as any)[key];
    }
  }

  const result = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    select: "_id fullName email mobileNumber profilePicture role",
  }).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

const userProfileSetup = async (
  userId: string,
  payload: { country: string; currency: string; language: string },
) => {
  const result = await User.findByIdAndUpdate(
    userId,
    {
      country: payload.country,
      currency: payload.currency,
      language: payload.language,
    },
    {
      new: true,
      select: "_id fullName email country currency language",
    },
  ).lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

export const userService = {
  createUserIntoDb,
  getUsersFromDb,
  updateProfile,
  updateUserIntoDb,
  deleteUserFromDb,
  profileImageChange,
  accountUpdateIntoDb,
  userProfileSetup,
};
