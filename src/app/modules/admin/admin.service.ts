import { ContentType, AppContent } from "./appContent.model";
import { User, UserRole } from "../../models";
import { Payment, PaymentStatus } from "../payment/payment.model";
import { paginationHelper } from "../../../helpars/paginationHelper";

const getContentTypeName = (type: ContentType): string => {
  const typeNames: Record<ContentType, string> = {
    [ContentType.ABOUT_US]: "About Us",
    [ContentType.PRIVACY_POLICY]: "Privacy Policy",
    [ContentType.TERMS_AND_CONDITIONS]: "Terms and Conditions",
  };
  return typeNames[type] || type;
};

const createOrUpdateContent = async (type: ContentType, content: string) => {
  const result = await AppContent.findOneAndUpdate(
    { type },
    { content },
    { new: true, upsert: true, runValidators: true },
  );
  return result;
};

const getContentByType = async (type: ContentType) => {
  const result = await AppContent.findOne({ type });
  if (!result) {
    return {
      _id: null,
      type,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return result;
};

const getUsersCount = async () => {
  const totalUsers = await User.countDocuments({ role: UserRole.USER });
  const activeUsers = await User.countDocuments({
    role: UserRole.USER,
    status: "ACTIVE",
  });
  const inactiveUsers = await User.countDocuments({
    role: UserRole.USER,
    status: "INACTIVE",
  });
  return {
    "Inactive Users": inactiveUsers,
    "Active Users": activeUsers,
    "Total Users": totalUsers,
  };
};

const getMonthlyUserGrowth = async (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const result = await User.aggregate([
    {
      $match: {
        role: UserRole.USER,
        createdAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        newUsers: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const monthlyDataMap = new Map(
    result.map((item) => [item._id, item.newUsers]),
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    newUsers: monthlyDataMap.get(i + 1) || 0,
  }));

  return { year, months };
};

const getMonthlyPremiumUsersGrowth = async (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const result = await Payment.aggregate([
    {
      $match: {
        status: PaymentStatus.COMPLETED,
        paidAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$paidAt" },
          userId: "$userId",
        },
      },
    },
    {
      $group: {
        _id: "$_id.month",
        newPremiumUsers: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const monthlyDataMap = new Map(
    result.map((item) => [item._id, item.newPremiumUsers]),
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    newPremiumUsers: monthlyDataMap.get(i + 1) || 0,
  }));

  return { year, months };
};

const getRecentUsers = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const users = await User.find(
    {
      role: UserRole.USER,
      createdAt: { $gte: sevenDaysAgo },
    },
    {
      fullName: 1,
      email: 1,
      profilePicture: 1,
      mobileNumber: 1,
      country: 1,
      createdAt: 1,
      status: 1,
    },
  )
    .sort({ createdAt: -1 })
    .lean();

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return users.map((user) => ({
    name: user.fullName || null,
    email: user.email || null,
    profilePicture: user.profilePicture || null,
    phoneNumber: user.mobileNumber || null,
    location: user.country || null,
    joinedDate: user.createdAt ? formatDate(user.createdAt) : null,
    status: user.status || null,
  }));
};

const getAllUsers = async (
  plan?: string,
  status?: string,
  page?: number,
  limit?: number,
) => {
  const query: Record<string, unknown> = { role: UserRole.USER };

  if (plan) {
    query.premiumPlan = plan;
  }
  if (status) {
    query.status = status;
  }

  const paginationData = paginationHelper.calculatePagination({
    page,
    limit,
  });

  const total = await User.countDocuments(query);

  const users = await User.find(query, {
    fullName: 1,
    email: 1,
    profilePicture: 1,
    mobileNumber: 1,
    country: 1,
    premiumPlan: 1,
    status: 1,
  })
    .sort({ createdAt: -1 })
    .skip(paginationData.skip)
    .limit(paginationData.limit)
    .lean();

  const formattedUsers = users.map((user) => ({
    name: user.fullName || null,
    email: user.email || null,
    profilePicture: user.profilePicture || null,
    phoneNumber: user.mobileNumber || null,
    location: user.country || null,
    premiumPlan: user.premiumPlan || null,
    status: user.status || null,
  }));

  return {
    meta: {
      page: paginationData.page,
      limit: paginationData.limit,
      total,
      totalPages: Math.ceil(total / paginationData.limit),
    },
    data: formattedUsers,
  };
};

const getPlanCount = async () => {
  const trialUsers = await User.countDocuments({ premiumPlan: "TRIAL" });
  const monthlyUsers = await User.countDocuments({ premiumPlan: "MONTHLY" });
  const annualUsers = await User.countDocuments({ premiumPlan: "ANNUAL" });
  const lifetimeUsers = await User.countDocuments({ premiumPlan: "LIFETIME" });

  return {
    "Trial Users": trialUsers,
    "Monthly Users": monthlyUsers,
    "Annual Users": annualUsers,
    "Lifetime Users": lifetimeUsers,
  };
};

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
  getUsersCount,
  getMonthlyUserGrowth,
  getMonthlyPremiumUsersGrowth,
  getRecentUsers,
  getAllUsers,
  getPlanCount,
};
