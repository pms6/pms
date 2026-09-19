import Property from "../models/Property.js";
import { generateSchedule } from "../utils/cleaningPlan.js";

/**
 * Sweep: top up the automatic cleaning schedule for every organization that has
 * properties. One organization failing does not stop the rest.
 */
export const generateAllSchedules = async () => {
  const result = { created: 0, errors: 0 };

  try {
    const organizationIds = await Property.distinct("organizationId", {
      isDeleted: false,
      status: "ACTIVE",
    });

    for (const organizationId of organizationIds) {
      try {
        const { created } = await generateSchedule({ organizationId });
        result.created += created;
      } catch (error) {
        result.errors++;
        console.error(`Cleaning schedule failed for ${organizationId}:`, error);
      }
    }
  } catch (error) {
    result.errors++;
    console.error("Cleaning schedule sweep failed:", error);
  }

  return result;
};
