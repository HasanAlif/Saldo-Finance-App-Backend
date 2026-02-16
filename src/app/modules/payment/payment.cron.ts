import cron from "node-cron";
import { User, PremiumPlan } from "../../models/User.model";

const scheduleExpiryCheck = () => {
  // Run every day at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();

      const result = await User.updateMany(
        {
          premiumPlan: { $in: [PremiumPlan.MONTHLY, PremiumPlan.ANNUAL] },
          premiumPlanExpiry: { $ne: null, $lte: now },
        },
        {
          $set: {
            premiumPlan: PremiumPlan.TRIAL_EXPIRED,
            premiumPlanExpiry: null,
          },
        },
      );

      if (result.modifiedCount > 0) {
        console.log(
          `[Cron] Expired ${result.modifiedCount} premium plan(s) at ${now.toISOString()}`,
        );
      }
    } catch (error) {
      console.error("[Cron] Error checking premium plan expiry:", error);
    }
  });

  console.log("[Cron] Premium plan expiry check scheduled (daily at 00:00)");
};

export default scheduleExpiryCheck;
