import { ContentType, AppContent } from "./appContent.model";
import { User, UserRole } from "../../models";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { Balance } from "../balance/balance.model";
import { Goals } from "../goals/goals.model";
import { Borrowed } from "../borrowed/borrowed.model";
import { Lent } from "../lent/lent.model";
import { Budget } from "../budget/budget.model";

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

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
  getUsersCount,
};
