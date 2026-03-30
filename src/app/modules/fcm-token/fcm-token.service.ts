import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import { User, DeviceType, IFcmToken } from "../../models";
import { generateDeviceUUID } from "../../../utils/generateDeviceUUID";

const MAX_DEVICES_PER_USER = 10;

interface RegisterTokenPayload {
  fcmToken: string;
  deviceId: string;
  deviceType: DeviceType;
  deviceName?: string;
}

// Register or update FCM token for a device
const registerToken = async (userId: string, payload: RegisterTokenPayload) => {
  const { fcmToken, deviceId: rawDeviceId, deviceType, deviceName } = payload;

  // Convert device ID to UUID for consistent storage
  const deviceId = generateDeviceUUID(rawDeviceId);

  const user = await User.findById(userId).select("+fcmTokens");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Initialize fcmTokens array if undefined
  if (!user.fcmTokens) {
    user.fcmTokens = [];
  }

  // Find existing token entry for this device
  const existingIndex = user.fcmTokens.findIndex(
    (t) => t.deviceId === deviceId,
  );

  if (existingIndex !== -1) {
    // Update existing device's token
    user.fcmTokens[existingIndex].token = fcmToken;
    user.fcmTokens[existingIndex].lastActiveAt = new Date();
    if (deviceName) {
      user.fcmTokens[existingIndex].deviceName = deviceName;
    }
  } else {
    // Add new device
    if (user.fcmTokens.length >= MAX_DEVICES_PER_USER) {
      // Remove oldest device to make room
      user.fcmTokens.sort(
        (a, b) =>
          new Date(a.lastActiveAt).getTime() -
          new Date(b.lastActiveAt).getTime(),
      );
      user.fcmTokens.shift();
    }

    user.fcmTokens.push({
      token: fcmToken,
      deviceId,
      deviceType,
      deviceName,
      lastActiveAt: new Date(),
      createdAt: new Date(),
    } as IFcmToken);
  }

  // Remove any duplicate tokens (same token on different deviceIds)
  const tokenSet = new Set<string>();
  user.fcmTokens = user.fcmTokens.filter((t) => {
    if (tokenSet.has(t.token)) {
      return t.deviceId === deviceId;
    }
    tokenSet.add(t.token);
    return true;
  });

  await user.save();

  return {
    message: "Token registered successfully",
    deviceCount: user.fcmTokens.length,
  };
};

// Delete token for specific device (called on logout)
const deleteToken = async (userId: string, rawDeviceId: string) => {
  // Convert device ID to UUID for consistent lookup
  const deviceId = generateDeviceUUID(rawDeviceId);

  const result = await User.findByIdAndUpdate(
    userId,
    { $pull: { fcmTokens: { deviceId } } },
    { new: true, select: "_id" },
  );

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return { message: "Token deleted successfully" };
};

// Delete specific token by value (called when Firebase returns invalid token error)
const removeInvalidToken = async (userId: string, token: string) => {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { token } } });
};

// Bulk remove invalid tokens (called after batch send)
const removeInvalidTokensBulk = async (
  invalidTokens: Array<{ userId: string; token: string }>,
) => {
  if (!invalidTokens.length) return;

  const bulkOps = invalidTokens.map(({ userId, token }) => ({
    updateOne: {
      filter: { _id: userId },
      update: { $pull: { fcmTokens: { token } } },
    },
  }));

  await User.bulkWrite(bulkOps);
};

export const fcmTokenService = {
  registerToken,
  deleteToken,
  removeInvalidToken,
  removeInvalidTokensBulk,
};
