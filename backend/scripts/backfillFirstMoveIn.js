/**
 * One-off backfill for "First Move-In Date" on both registers that carry it.
 *
 * Tenancies
 * ---------
 * A renewal is a new tenancy record, so a tenant on their third contract has
 * three rows. Their first move-in is the EARLIEST start date across all of
 * them, and that is what every one of their rows gets stamped with. Grouped by
 * tenantId where there is one, otherwise by email — which is how a tenancy
 * entered without a profile is still recognised as the same person.
 *
 * This one is exact: the records already hold the answer, nothing is guessed.
 *
 * Clients
 * -------
 * The client register has one row per client and no history, so the best
 * evidence we hold is the start of the contract currently on the row. That is a
 * floor, not a fact: a client who has renewed moved in before it. The stamped
 * date can only under-count a stay, never overstate it, and the real first
 * move-in has to be typed in afterwards for anyone who has renewed.
 *
 *   node scripts/backfillFirstMoveIn.js              # both registers
 *   node scripts/backfillFirstMoveIn.js --dry        # preview, write nothing
 *   node scripts/backfillFirstMoveIn.js --tenancies  # tenancies only
 *   node scripts/backfillFirstMoveIn.js --clients    # clients only
 *
 * Safe to re-run: it only touches rows with no first move-in date, so a date
 * typed in by hand is never overwritten.
 */
import { connectDB, disconnectDB } from "../config/db.js";
import Client from "../models/Client.js";
import Tenancy from "../models/Tenancy.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ONLY_TENANCIES = args.includes("--tenancies");
const ONLY_CLIENTS = args.includes("--clients");
const doTenancies = !ONLY_CLIENTS;
const doClients = !ONLY_TENANCIES;

const MISSING = { $or: [{ firstMoveInDate: null }, { firstMoveInDate: { $exists: false } }] };
const uk = (d) => new Date(d).toLocaleDateString("en-GB");

/** The key that identifies one person across their tenancies. */
const personKey = (t) =>
  t.tenantId ? `id:${t.tenantId}` : t.tenantEmail ? `email:${String(t.tenantEmail).toLowerCase()}` : null;

const backfillTenancies = async () => {
  console.log("\n— Tenancies —");

  // Every tenancy, not just the ones missing a date: an earlier row is what
  // tells us when a later one's tenant first moved in.
  const all = await Tenancy.find({})
    .select("_id organizationId tenantId tenantEmail tenant startDate firstMoveInDate")
    .lean();

  // person -> earliest date known for them
  const earliest = new Map();
  for (const t of all) {
    const key = personKey(t);
    if (!key) continue;
    for (const raw of [t.firstMoveInDate, t.startDate]) {
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const seen = earliest.get(key);
      if (!seen || d < seen) earliest.set(key, d);
    }
  }

  const todo = all.filter((t) => !t.firstMoveInDate);
  console.log(`${todo.length} tenancy row(s) have no first move-in date.`);

  let written = 0;
  let skipped = 0;
  for (const t of todo) {
    const key = personKey(t);
    const when = (key && earliest.get(key)) || (t.startDate ? new Date(t.startDate) : null);
    if (!when) {
      skipped += 1;
      continue;
    }
    const renewal = t.startDate && when < new Date(t.startDate);
    console.log(
      `  ${t.tenant || t.tenantEmail || t._id} → ${uk(when)}${renewal ? "  (earlier than this tenancy — a renewal)" : ""}`
    );
    if (!DRY) {
      await Tenancy.updateOne({ _id: t._id }, { $set: { firstMoveInDate: when } });
      written += 1;
    }
  }

  if (skipped) console.log(`  ${skipped} row(s) skipped — no date on record to work from.`);
  console.log(DRY ? "Dry run — nothing written." : `Stamped ${written} tenancy row(s).`);
};

const backfillClients = async () => {
  console.log("\n— Clients —");

  const rows = await Client.find({ ...MISSING, contractStart: { $ne: null } })
    .select("_id tenant property contractStart")
    .lean();

  console.log(`${rows.length} client row(s) have a contract start and no first move-in date.`);

  let written = 0;
  for (const row of rows) {
    console.log(`  ${row.tenant} · ${row.property} → ${uk(row.contractStart)}`);
    if (!DRY) {
      await Client.updateOne({ _id: row._id }, { $set: { firstMoveInDate: row.contractStart } });
      written += 1;
    }
  }

  console.log(
    DRY
      ? "Dry run — nothing written."
      : `Stamped ${written} client row(s). Clients who have renewed need their real first move-in typed in.`
  );
};

const run = async () => {
  await connectDB();
  if (doTenancies) await backfillTenancies();
  if (doClients) await backfillClients();
  if (DRY) console.log("\nRe-run without --dry to apply.");
  await disconnectDB();
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
