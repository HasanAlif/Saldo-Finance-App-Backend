import * as bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User } from "../../models/User.model";
import { fileUploader } from "../../../helpars/fileUploader";

interface UpdateProfilePayload {
  fullName?: string;
  mobileNumber?: string;
  country?: string;
  currency?: string;
  language?: string;
}

const getProfile = async (userId: string) => {
  const user = await User.findById(userId)
    .select("fullName mobileNumber profilePicture country currency language")
    .lean();

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

const updateProfile = async (
  userId: string,
  payload: UpdateProfilePayload,
  file?: Express.Multer.File,
) => {
  const updateData: Record<string, unknown> = {};

  if (payload.fullName !== undefined) updateData.fullName = payload.fullName;
  if (payload.mobileNumber !== undefined)
    updateData.mobileNumber = payload.mobileNumber;
  if (payload.country !== undefined) updateData.country = payload.country;
  if (payload.currency !== undefined) updateData.currency = payload.currency;
  if (payload.language !== undefined) updateData.language = payload.language;

  if (file) {
    const currentUser = await User.findById(userId)
      .select("profilePicture")
      .lean();

    if (currentUser?.profilePicture) {
      try {
        const urlParts = currentUser.profilePicture.split("/");
        const folderAndFile = urlParts.slice(-2).join("/");
        const publicId = folderAndFile.split(".")[0];

        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error("Failed to delete old profile picture:", error);
      }
    }

    const uploadResult = await fileUploader.uploadToCloudinary(
      file,
      "profile-images",
    );
    updateData.profilePicture = uploadResult.Location;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided to update");
  }

  const result = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true },
  )
    .select("fullName mobileNumber profilePicture country currency language")
    .lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  const user = await User.findById(userId).select("+password").lean();

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for Google sign-in accounts",
    );
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  return { message: "Password changed successfully" };
};

export const profileService = {
  getProfile,
  updateProfile,
  changePassword,
};
