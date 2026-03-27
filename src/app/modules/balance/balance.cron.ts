import cron from "node-cron";
import mongoose from "mongoose";
import { User } from "../../models/User.model";
import { Balance } from "./balance.model";
import { FillForYear, FillForYearTransactionType } from "./FillForYear.model";
import { Income } from "./income.model";
import { Spending } from "./spending.model";

const formatUtcTime = (date: Date): string => {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const processFillForYearEntries = async () => {
  try {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentDay = now.getUTCDate();
    const cycleKey = `${currentYear}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const templates = await FillForYear.find({ year: currentYear })
      .select("userId accountId name category amount year type")
      .lean();

    if (!templates.length) {
      return;
    }

    const userMonthStartCache = new Map<string, number>();

    for (const template of templates) {
      const userId = template.userId.toString();
      let monthStartDate = userMonthStartCache.get(userId);

      if (monthStartDate === undefined) {
        const user = await User.findById(template.userId)
          .select("monthStartDate")
          .lean();

        if (!user) {
          continue;
        }

        const rawMonthStartDate = user.monthStartDate;
        const isValidMonthStartDate =
          typeof rawMonthStartDate === "number" &&
          Number.isInteger(rawMonthStartDate) &&
          rawMonthStartDate >= 1 &&
          rawMonthStartDate <= 28;

        monthStartDate = isValidMonthStartDate ? rawMonthStartDate : 1;

        if (!isValidMonthStartDate) {
          await User.updateOne(
            { _id: template.userId },
            { $set: { monthStartDate: 1 } },
          );
        }

        userMonthStartCache.set(userId, monthStartDate);
      }

      if (monthStartDate !== currentDay) {
        continue;
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const lockedTemplate = await FillForYear.findOneAndUpdate(
          {
            _id: template._id,
            year: currentYear,
            processedCycles: { $ne: cycleKey },
          },
          {
            $push: { processedCycles: cycleKey },
            $set: { lastProcessedAt: now },
          },
          { new: true, session },
        ).lean();

        if (!lockedTemplate) {
          await session.abortTransaction();
          continue;
        }

        const account = await Balance.findOne({
          _id: template.accountId,
          userId: template.userId,
        })
          .select("_id")
          .session(session)
          .lean();

        if (!account) {
          await session.abortTransaction();
          continue;
        }

        const entryDate = new Date();
        const entryTime = formatUtcTime(entryDate);

        if (template.type === FillForYearTransactionType.INCOME) {
          await Income.create(
            [
              {
                userId: template.userId,
                accountId: template.accountId,
                name: template.name,
                category: template.category,
                amount: template.amount,
                date: entryDate,
                time: entryTime,
                fillForAllYear: false,
              },
            ],
            { session },
          );

          await Balance.updateOne(
            { _id: template.accountId, userId: template.userId },
            {
              $inc: { amount: template.amount },
              $set: { lastUpdated: entryDate },
            },
            { session },
          );
        } else if (template.type === FillForYearTransactionType.SPENDING) {
          await Spending.create(
            [
              {
                userId: template.userId,
                accountId: template.accountId,
                name: template.name,
                category: template.category,
                amount: template.amount,
                date: entryDate,
                time: entryTime,
                fillForAllYear: false,
              },
            ],
            { session },
          );

          await Balance.updateOne(
            { _id: template.accountId, userId: template.userId },
            {
              $inc: { amount: -template.amount },
              $set: { lastUpdated: entryDate },
            },
            { session },
          );
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        console.error(
          `[Cron] Error processing FillForYear entry ${template._id}:`,
          error,
        );
      } finally {
        session.endSession();
      }
    }

    console.log(
      `[Cron] FillForYear processing completed for ${currentYear}-${String(
        now.getUTCMonth() + 1,
      ).padStart(2, "0")}`,
    );
  } catch (error) {
    console.error("[Cron] Error running FillForYear processing:", error);
  }
};

const scheduleFillForYearCron = () => {
  cron.schedule("0 0 * * *", processFillForYearEntries);
  console.log("[Cron] FillForYear processing scheduled (daily at 00:00 UTC)");
};

export { scheduleFillForYearCron, processFillForYearEntries };
