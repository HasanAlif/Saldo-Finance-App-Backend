import { ContentType, AppContent } from "./appContent.model";
import { User, UserRole } from "../../models";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { Balance } from "../balance/balance.model";
import { Goals } from "../goals/goals.model";
import { Borrowed } from "../borrowed/borrowed.model";
import { Lent } from "../lent/lent.model";
import { Budget } from "../budget/budget.model";
import { Payment, PaymentStatus } from "../payment/payment.model";

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
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFilter = { $gte: thirtyDaysAgo };

  const [
    totalUsers,
    incomeActiveUsers,
    spendingActiveUsers,
    balanceActiveUsers,
    goalsActiveUsers,
    borrowedActiveUsers,
    lentActiveUsers,
    budgetActiveUsers,
  ] = await Promise.all([
    User.countDocuments({ role: UserRole.USER }),
    Income.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Spending.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Balance.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Goals.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Borrowed.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Lent.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
    Budget.distinct("userId", {
      $or: [{ createdAt: dateFilter }, { updatedAt: dateFilter }],
    }),
  ]);

  const activeUserIds = new Set([
    ...incomeActiveUsers.map((id) => id.toString()),
    ...spendingActiveUsers.map((id) => id.toString()),
    ...balanceActiveUsers.map((id) => id.toString()),
    ...goalsActiveUsers.map((id) => id.toString()),
    ...borrowedActiveUsers.map((id) => id.toString()),
    ...lentActiveUsers.map((id) => id.toString()),
    ...budgetActiveUsers.map((id) => id.toString()),
  ]);

  const activeUsers = activeUserIds.size;
  const inactiveUsers = totalUsers - activeUsers;

  return {
    "Active Users": activeUsers,
    "InActive Users": inactiveUsers,
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

const getAllUsers = async (plan?: string, status?: string) => {
  const query: Record<string, unknown> = { role: UserRole.USER };

  if (plan) {
    query.premiumPlan = plan;
  }
  if (status) {
    query.status = status;
  }

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
    .lean();

  return users.map((user) => ({
    name: user.fullName || null,
    email: user.email || null,
    profilePicture: user.profilePicture || null,
    phoneNumber: user.mobileNumber || null,
    location: user.country || null,
    premiumPlan: user.premiumPlan || null,
    status: user.status || null,
  }));
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
};
