/**
 * One-off first run of the automatic cleaning schedule.
 *
 * The schedule starts on the coming Monday — today is skipped — and this runs
 * it once. After that the daily job (cranjob/cleaningSchedule.js) keeps it
 * topped up.
 *
 *   node scripts/generateCleaningSchedule.js             # generate
 *   node scripts/generateCleaningSchedule.js --dry       # preview, write nothing
 *   node scripts/generateCleaningSchedule.js --org <id>  # one organisation only
 *
 * Safe to re-run: only entries that are missing are added.
 */
import { connectDB, disconnectDB } from "../config/db.js";
import Property from "../models/Property.js";
import { generateSchedule, nextMonday } from "../utils/cleaningPlan.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const orgFlag = args.indexOf("--org");
const ONLY_ORG = orgFlag !== -1 ? args[orgFlag + 1] : null;

const run = async () => {
  await connectDB();

  const startDate = nextMonday();
  console.log(`Schedule starts on ${startDate.toISOString().slice(0, 10)} (Monday)${DRY ? " — dry run" : ""}`);

  const organizationIds = ONLY_ORG
    ? [ONLY_ORG]
    : await Property.distinct("organizationId", { isDeleted: false, status: "ACTIVE" });

  let total = 0;
  for (const organizationId of organizationIds) {
    const result = await generateSchedule({ organizationId, startDate, dryRun: DRY });
    const n = DRY ? result.planned || 0 : result.created;
    total += n;
    console.log(`  ${organizationId}: ${n} ${DRY ? "would be added" : "added"}`);
  }

  console.log(`Done — ${total} ${DRY ? "would be added" : "added"} across ${organizationIds.length} organisation(s).`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
