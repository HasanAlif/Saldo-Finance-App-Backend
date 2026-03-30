import cron from "node-cron";
import { User, Notification, NotificationType } from "../../models";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { notificationServices } from "./notification.service";

const BATCH_SIZE = Math.max(
  1,
  Number(process.env.NOTIFICATION_BATCH_SIZE) || 500,
);
const STALE_DAYS = Math.max(7, Number(process.env.FCM_TOKEN_STALE_DAYS) || 60);

const getDatePartValue = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) => Number(parts.find((part) => part.type === type)?.value || 0);

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const asUtc = Date.UTC(
    getDatePartValue(parts, "year"),
    getDatePartValue(parts, "month") - 1,
    getDatePartValue(parts, "day"),
    getDatePartValue(parts, "hour"),
    getDatePartValue(parts, "minute"),
    getDatePartValue(parts, "second"),
  );

  return asUtc - date.getTime();
};

const getUtcStartForTimeZoneDate = (
  year: number,
  month: number,
  day: number,
  timeZone: string,
) => {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMs);
};

const getTimeZoneDayRangeUtc = (referenceDate: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);

  const year = getDatePartValue(parts, "year");
  const month = getDatePartValue(parts, "month");
  const day = getDatePartValue(parts, "day");

  const startUtc = getUtcStartForTimeZoneDate(year, month, day, timeZone);
  const nextStartUtc = getUtcStartForTimeZoneDate(
    year,
    month,
    day + 1,
    timeZone,
  );

  return {
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    startUtc,
    endUtc: new Date(nextStartUtc.getTime() - 1),
  };
};

const scheduleDailyReminder = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();

      const timezones: string[] = await User.distinct("timezone", {
        status: "ACTIVE",
        fcmTokens: { $exists: true, $not: { $size: 0 } },
      });

      if (!timezones.length) return;

      const targetTimezones = timezones.filter((tz) => {
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: tz,
          });
          return parseInt(formatter.format(now), 10) === 21;
        } catch {
          return false;
        }
      });

      if (!targetTimezones.length) return;

      for (const tz of targetTimezones) {
        const {
          dateKey: todayStr,
          startUtc: todayStart,
          endUtc: todayEnd,
        } = getTimeZoneDayRangeUtc(now, tz);

        const users = await User.find({
          timezone: tz,
          status: "ACTIVE",
          fcmTokens: { $exists: true, $not: { $size: 0 } },
        })
          .select("_id")
          .lean();

        if (!users.length) continue;

        const userIds = users.map((u) => u._id.toString());

        const alreadySentIds = await Notification.distinct("userId", {
          userId: { $in: userIds },
          "data.notifType": "DAILY_REMINDER",
          "data.date": todayStr,
        });

        const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
        const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

        if (!eligibleIds.length) continue;

        const [activeIncome, activeSpending] = await Promise.all([
          Income.distinct("userId", {
            userId: { $in: eligibleIds },
            date: { $gte: todayStart, $lte: todayEnd },
          }),
          Spending.distinct("userId", {
            userId: { $in: eligibleIds },
            date: { $gte: todayStart, $lte: todayEnd },
          }),
        ]);

        const activeSet = new Set([
          ...activeIncome.map((id: any) => id.toString()),
          ...activeSpending.map((id: any) => id.toString()),
        ]);

        const inactiveIds = eligibleIds.filter(
          (id) => !activeSet.has(id.toString()),
        );

        if (!inactiveIds.length) continue;

        const title = "Daily Reminder";
        const body =
          "Today you have not entry any activity. For not losing flow of your saving goal and tracking your entry please perform todays activity.";
        const data = { notifType: "DAILY_REMINDER", date: todayStr };

        for (let i = 0; i < inactiveIds.length; i += BATCH_SIZE) {
          const batch = inactiveIds.slice(i, i + BATCH_SIZE);
          await notificationServices.sendBulkNotification(
            batch.map((id) => id.toString()),
            title,
            body,
            NotificationType.NORMAL,
            data,
          );
        }
      }

      console.log(
        `[Cron] Daily reminder completed for ${targetTimezones.length} timezone(s)`,
      );
    } catch (error) {
      console.error("[Cron] Daily reminder error:", error);
    }
  });

  console.log(
    "[Cron] Daily reminder scheduled (hourly, targets 21:00 local time)",
  );
};

const scheduleWeeklyReport = () => {
  cron.schedule("0 9 * * 0", async () => {
    try {
      const now = new Date();

      const weekEnd = new Date(now);
      weekEnd.setUTCDate(now.getUTCDate() - 1);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - 7);
      weekStart.setUTCHours(0, 0, 0, 0);

      const weekStartStr = weekStart.toISOString().split("T")[0];

      const users = await User.find({
        status: "ACTIVE",
        fcmTokens: { $exists: true, $not: { $size: 0 } },
      })
        .select("_id")
        .lean();

      if (!users.length) return;

      const userIds = users.map((u) => u._id.toString());

      const alreadySentIds = await Notification.distinct("userId", {
        userId: { $in: userIds },
        "data.notifType": "WEEKLY_REPORT",
        "data.weekStart": weekStartStr,
      });

      const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
      const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

      if (!eligibleIds.length) return;

      const [activeIncome, activeSpending] = await Promise.all([
        Income.distinct("userId", {
          userId: { $in: eligibleIds },
          date: { $gte: weekStart, $lte: weekEnd },
        }),
        Spending.distinct("userId", {
          userId: { $in: eligibleIds },
          date: { $gte: weekStart, $lte: weekEnd },
        }),
      ]);

      const activeSet = new Set([
        ...activeIncome.map((id: any) => id.toString()),
        ...activeSpending.map((id: any) => id.toString()),
      ]);

      const activeUserIds = eligibleIds.filter((id) =>
        activeSet.has(id.toString()),
      );
      const inactiveUserIds = eligibleIds.filter(
        (id) => !activeSet.has(id.toString()),
      );

      for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
        const batch = activeUserIds.slice(i, i + BATCH_SIZE);
        await notificationServices.sendBulkNotification(
          batch.map((id) => id.toString()),
          "Your Weekly Report Is Ready",
          "Click here to show your weekly report.",
          NotificationType.NORMAL,
          {
            notifType: "WEEKLY_REPORT",
            weekStart: weekStartStr,
            route: "/reports/weekly",
          },
        );
      }

      for (let i = 0; i < inactiveUserIds.length; i += BATCH_SIZE) {
        const batch = inactiveUserIds.slice(i, i + BATCH_SIZE);
        await notificationServices.sendBulkNotification(
          batch.map((id) => id.toString()),
          "Weekly Reminder",
          "You have not performed any activity this week. Please entry your income and spending and track your regular activity and save more money.",
          NotificationType.NORMAL,
          {
            notifType: "WEEKLY_REPORT",
            weekStart: weekStartStr,
          },
        );
      }

      console.log(
        `[Cron] Weekly report: ${activeUserIds.length} active, ${inactiveUserIds.length} inactive`,
      );
    } catch (error) {
      console.error("[Cron] Weekly report error:", error);
    }
  });

  console.log("[Cron] Weekly report scheduled (Sunday at 09:00 UTC)");
};

const scheduleMonthlyReport = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
      const today = new Date();
      const currentDay = today.getUTCDate();

      const users = await User.find({
        status: "ACTIVE",
        fcmTokens: { $exists: true, $not: { $size: 0 } },
        monthStartDate: currentDay,
      })
        .select("_id monthStartDate")
        .lean();

      if (!users.length) return;

      const userIds = users.map((u) => u._id.toString());

      const prevStart = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - 1,
          currentDay,
          0,
          0,
          0,
          0,
        ),
      );
      const prevEnd = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          currentDay - 1,
          23,
          59,
          59,
          999,
        ),
      );

      const monthStartStr = prevStart.toISOString().split("T")[0];

      const alreadySentIds = await Notification.distinct("userId", {
        userId: { $in: userIds },
        "data.notifType": "MONTHLY_REPORT",
        "data.monthStart": monthStartStr,
      });

      const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
      const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

      if (!eligibleIds.length) return;

      const [activeIncome, activeSpending] = await Promise.all([
        Income.distinct("userId", {
          userId: { $in: eligibleIds },
          date: { $gte: prevStart, $lte: prevEnd },
        }),
        Spending.distinct("userId", {
          userId: { $in: eligibleIds },
          date: { $gte: prevStart, $lte: prevEnd },
        }),
      ]);

      const activeSet = new Set([
        ...activeIncome.map((id: any) => id.toString()),
        ...activeSpending.map((id: any) => id.toString()),
      ]);

      const activeUserIds = eligibleIds.filter((id) =>
        activeSet.has(id.toString()),
      );
      const inactiveUserIds = eligibleIds.filter(
        (id) => !activeSet.has(id.toString()),
      );

      for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
        const batch = activeUserIds.slice(i, i + BATCH_SIZE);
        await notificationServices.sendBulkNotification(
          batch.map((id) => id.toString()),
          "Your Monthly Report Is Ready",
          "Click here to show your monthly report.",
          NotificationType.NORMAL,
          {
            notifType: "MONTHLY_REPORT",
            monthStart: monthStartStr,
            route: "/reports/monthly",
          },
        );
      }

      for (let i = 0; i < inactiveUserIds.length; i += BATCH_SIZE) {
        const batch = inactiveUserIds.slice(i, i + BATCH_SIZE);
        await notificationServices.sendBulkNotification(
          batch.map((id) => id.toString()),
          "Monthly Reminder",
          "You have not performed any activity within one month. Please entry your income and spending and track your regular activity and save more money.",
          NotificationType.NORMAL,
          {
            notifType: "MONTHLY_REPORT",
            monthStart: monthStartStr,
          },
        );
      }

      console.log(
        `[Cron] Monthly report: ${activeUserIds.length} active, ${inactiveUserIds.length} inactive`,
      );
    } catch (error) {
      console.error("[Cron] Monthly report error:", error);
    }
  });

  console.log("[Cron] Monthly report scheduled (daily at 09:00 UTC)");
};

const scheduleStaleTokenCleanup = () => {
  cron.schedule("0 3 * * *", async () => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);

      const result = await User.updateMany(
        {
          fcmTokens: {
            $elemMatch: { lastActiveAt: { $lt: cutoffDate } },
          },
        },
        {
          $pull: {
            fcmTokens: { lastActiveAt: { $lt: cutoffDate } },
          },
        },
      );

      console.log(
        `[Cron] Stale token cleanup: ${result.modifiedCount} user(s) updated`,
      );
    } catch (error) {
      console.error("[Cron] Stale token cleanup error:", error);
    }
  });

  console.log("[Cron] Stale FCM token cleanup scheduled (daily at 03:00 UTC)");
};

export const scheduleNotificationCrons = () => {
  scheduleDailyReminder();
  scheduleWeeklyReport();
  scheduleMonthlyReport();
  scheduleStaleTokenCleanup();
};
