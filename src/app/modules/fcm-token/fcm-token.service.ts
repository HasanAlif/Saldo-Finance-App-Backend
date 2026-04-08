import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import { cleanObject } from "../../../helpars/cleanObject";
import { User, DeviceType } from "../../models";
import { generateDeviceUUID } from "../../../utils/generateDeviceUUID";

const MAX_DEVICES_PER_USER = 10;

interface RegisterTokenPayload {
  fcmToken: string;
  deviceId: string;
  deviceType: DeviceType;
  deviceName?: string;
}

const registerToken = async (userId: string, payload: RegisterTokenPayload) => {
  const {
    fcmToken: rawFcmToken,
    deviceId: rawDeviceId,
    deviceType,
    deviceName,
  } = payload;

  const fcmToken = rawFcmToken?.trim();
  const normalizedDeviceName = deviceName?.trim() || null;
  const now = new Date();

  if (!fcmToken || !rawDeviceId || !deviceType) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "fcmToken, deviceId, and deviceType are required",
    );
  }

  const deviceId = generateDeviceUUID(rawDeviceId);

  const result = await User.updateOne({ _id: userId }, [
    {
      $set: {
        __currentTokens: { $ifNull: ["$fcmTokens", []] },
      },
    },
    {
      $set: {
        __existingDeviceToken: {
          $first: {
            $filter: {
              input: "$__currentTokens",
              as: "existing",
              cond: { $eq: ["$$existing.deviceId", deviceId] },
            },
          },
        },
        __filteredTokens: {
          $filter: {
            input: "$__currentTokens",
            as: "existing",
            cond: {
              $and: [
                { $ne: ["$$existing.deviceId", deviceId] },
                { $ne: ["$$existing.token", fcmToken] },
              ],
            },
          },
        },
      },
    },
    {
      $set: {
        fcmTokens: {
          $concatArrays: [
            "$__filteredTokens",
            [
              {
                token: fcmToken,
                deviceId,
                deviceType,
                deviceName: normalizedDeviceName,
                lastActiveAt: now,
                createdAt: {
                  $ifNull: ["$__existingDeviceToken.createdAt", now],
                },
              },
            ],
          ],
        },
      },
    },
    {
      $set: {
        fcmTokens: {
          $slice: [
            {
              $sortArray: {
                input: "$fcmTokens",
                sortBy: { lastActiveAt: -1 },
              },
            },
            MAX_DEVICES_PER_USER,
          ],
        },
      },
    },
    {
      $unset: ["__currentTokens", "__existingDeviceToken", "__filteredTokens"],
    },
  ]);

  if (result.matchedCount === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const refreshedUser = await User.findById(userId).select("+fcmTokens").lean();

  return {
    message: "Token registered successfully",
    deviceCount: refreshedUser?.fcmTokens?.length || 0,
  };
};

const deleteToken = async (userId: string, rawDeviceId: string) => {
  const deviceId = generateDeviceUUID(rawDeviceId);

  const result = await User.updateOne(
    { _id: userId },
    { $pull: { fcmTokens: { deviceId: { $in: [deviceId, rawDeviceId] } } } },
  );

  if (result.matchedCount === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return {
    message: "Token deleted successfully",
    removed: result.modifiedCount > 0,
  };
};

const removeInvalidToken = async (userId: string, token: string) => {
  await User.updateOne(
    { _id: userId, "fcmTokens.token": token },
    { $pull: { fcmTokens: { token } } },
  );
};

const removeInvalidTokensBulk = async (
  invalidTokens: Array<{ userId: string; token: string }>,
) => {
  if (!invalidTokens.length) return;

  const tokenMapByUser = new Map<string, Set<string>>();

  for (const { userId, token } of invalidTokens) {
    if (!tokenMapByUser.has(userId)) {
      tokenMapByUser.set(userId, new Set());
    }
    tokenMapByUser.get(userId)!.add(token);
  }

  const bulkOps = Array.from(tokenMapByUser.entries()).map(
    ([userId, tokenSet]) => ({
      updateOne: {
        filter: { _id: userId },
        update: {
          $pull: { fcmTokens: { token: { $in: Array.from(tokenSet) } } },
        },
      },
    }),
  );

  await User.bulkWrite(bulkOps);
};

export const fcmTokenService = {
  registerToken,
  deleteToken,
  removeInvalidToken,
  removeInvalidTokensBulk,
};
