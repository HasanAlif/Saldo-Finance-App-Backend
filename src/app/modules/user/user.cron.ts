import cron from "node-cron";
import { User, UserRole, UserStatus } from "../../models/User.model";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { Balance } from "../balance/balance.model";
import { Goals } from "../goals/goals.model";
import { Borrowed } from "../borrowed/borrowed.model";
import { Lent } from "../lent/lent.model";
import { Budget } from "../budget/budget.model";

const updateUserStatus = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dateFilter = { $gte: thirtyDaysAgo };

    const [
      incomeActiveUsers,
      spendingActiveUsers,
      balanceActiveUsers,
      goalsActiveUsers,
      borrowedActiveUsers,
      lentActiveUsers,
      budgetActiveUsers,
    ] = await Promise.all([
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

    const activeUserIds = [
      ...incomeActiveUsers,
      ...spendingActiveUsers,
      ...balanceActiveUsers,
      ...goalsActiveUsers,
      ...borrowedActiveUsers,
      ...lentActiveUsers,
      ...budgetActiveUsers,
    ];

    const [activeResult, inactiveResult] = await Promise.all([
      User.updateMany(
        {
          _id: { $in: activeUserIds },
          role: UserRole.USER,
          status: { $ne: UserStatus.ACTIVE },
        },
        { $set: { status: UserStatus.ACTIVE } },
      ),
      User.updateMany(
        {
          _id: { $nin: activeUserIds },
          role: UserRole.USER,
          status: { $ne: UserStatus.INACTIVE },
        },
        { $set: { status: UserStatus.INACTIVE } },
      ),
    ]);
  } catch (error) {
    console.error("[Cron] Error updating user status:", error);
  }
};

const scheduleUserStatusUpdate = () => {
  cron.schedule("0 0 * * *", updateUserStatus);
  console.log("[Cron] User status update scheduled (daily at 00:00)");
};

export { scheduleUserStatusUpdate, updateUserStatus };
