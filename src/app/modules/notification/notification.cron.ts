import cron from "node-cron";
import { User, Notification, NotificationType } from "../../models";
import { Income } from "../balance/income.model";
import { Spending } from "../balance/spending.model";
import { notificationServices } from "./notification.service";

const BATCH_SIZE = 500;

// ==========================================
// Daily Reminder - Runs every hour, targets users at 21:00 local time
// ==========================================
const scheduleDailyReminder = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();

      // Get all distinct timezones from active users with FCM tokens
      const timezones: string[] = await User.distinct("timezone", {
        status: "ACTIVE",
        fcmToken: { $exists: true, $ne: null },
      });

      if (!timezones.length) return;

      // Find timezones where local hour is 21
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
        // Get today's date in this timezone
        const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });
        const todayStart = new Date(todayStr + "T00:00:00.000Z");
        const todayEnd = new Date(todayStr + "T23:59:59.999Z");

        // Get users in this timezone
        const users = await User.find({
          timezone: tz,
          status: "ACTIVE",
          fcmToken: { $exists: true, $ne: null },
        })
          .select("_id")
          .lean();

        if (!users.length) continue;

        const userIds = users.map((u) => u._id);

        // Exclude users who already received daily reminder today
        const alreadySentIds = await Notification.distinct("userId", {
          userId: { $in: userIds },
          "data.notifType": "DAILY_REMINDER",
          "data.date": todayStr,
        });

        const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
        const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

        if (!eligibleIds.length) continue;

        // Find users who already have activity today (batch query)
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

        // Only send to users with NO activity today
        const inactiveIds = eligibleIds.filter(
          (id) => !activeSet.has(id.toString()),
        );

        if (!inactiveIds.length) continue;

        const title = "Daily Reminder";
        const body =
          "Today you have not entry any activity. For not losing flow of your saving goal and tracking your entry please perform todays activity.";
        const data = { notifType: "DAILY_REMINDER", date: todayStr };

        // Send in batches of BATCH_SIZE
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

// ==========================================
// Weekly Report - Every Sunday at 09:00 UTC
// ==========================================
const scheduleWeeklyReport = () => {
  cron.schedule("0 9 * * 0", async () => {
    try {
      const now = new Date();

      // Calculate the past week range (last 7 days)
      const weekEnd = new Date(now);
      weekEnd.setUTCDate(now.getUTCDate() - 1);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - 7);
      weekStart.setUTCHours(0, 0, 0, 0);

      const weekStartStr = weekStart.toISOString().split("T")[0];

      // Get all active users with FCM tokens
      const users = await User.find({
        status: "ACTIVE",
        fcmToken: { $exists: true, $ne: null },
      })
        .select("_id")
        .lean();

      if (!users.length) return;

      const userIds = users.map((u) => u._id);

      // Exclude users who already received this weekly report
      const alreadySentIds = await Notification.distinct("userId", {
        userId: { $in: userIds },
        "data.notifType": "WEEKLY_REPORT",
        "data.weekStart": weekStartStr,
      });

      const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
      const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

      if (!eligibleIds.length) return;

      // Find which users had activity this week (batch query)
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

      // Send "report ready" to active users
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

      // Send reminder to inactive users
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

// ==========================================
// Monthly Report - Daily at 09:00 UTC
// Checks if today is a user's monthStartDate
// ==========================================
const scheduleMonthlyReport = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
      const today = new Date();
      const currentDay = today.getUTCDate();

      // Find users whose new month cycle starts today
      const users = await User.find({
        status: "ACTIVE",
        fcmToken: { $exists: true, $ne: null },
        monthStartDate: currentDay,
      })
        .select("_id monthStartDate")
        .lean();

      if (!users.length) return;

      const userIds = users.map((u) => u._id);

      // Calculate previous cycle date range
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

      // Exclude users who already received this monthly report
      const alreadySentIds = await Notification.distinct("userId", {
        userId: { $in: userIds },
        "data.notifType": "MONTHLY_REPORT",
        "data.monthStart": monthStartStr,
      });

      const sentSet = new Set(alreadySentIds.map((id: any) => id.toString()));
      const eligibleIds = userIds.filter((id) => !sentSet.has(id.toString()));

      if (!eligibleIds.length) return;

      // Find which users had activity in the previous month cycle
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

      // Send "report ready" to active users
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

      // Send reminder to inactive users
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

// ==========================================
// Register all notification cron jobs
// ==========================================
export const scheduleNotificationCrons = () => {
  scheduleDailyReminder();
  scheduleWeeklyReport();
  scheduleMonthlyReport();
};
