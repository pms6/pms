/**
 * One-off copy of existing check-ins into the client database.
 *
 * The client database used to be a read-only VIEW over CheckIn, so it showed
 * every check-in automatically. It is now its own collection, kept by hand and
 * independent of the check-in register — which means that on the day the change
 * ships, the screen starts empty.
 *
 * That is the intended end state ("I will add clients to the Client Database
 * manually"), but an organisation that already had clients showing there may
 * want them carried across once rather than retyped. This does that copy, ONCE,
 * on demand.
 *
 * It is deliberately a script and not part of the app:
 *   • Nothing in the running app writes a client from a check-in. If this ran
 *     automatically, the two registers would be linked again — the exact thing
 *     the change removes.
 *   • After it runs the copies are independent. Editing a check-in does not
 *     update the client it was copied from, and vice versa.
 *
 * The room rented date and the check-in date are NOT copied. Those belong to
 * the check-in register; the client database keeps only the contract dates.
 *
 *   node scripts/seedClientsFromCheckIns.js             # copy, skipping duplicates
 *   node scripts/seedClientsFromCheckIns.js --dry       # preview, write nothing
 *   node scripts/seedClientsFromCheckIns.js --org <id>  # one organisation only
 *
 * Safe to re-run: a check-in whose name + property + room already exists as a
 * client is skipped, so a second run does not double anybody up.
 */
import { connectDB, disconnectDB } from "../config/db.js";
import CheckIn from "../models/CheckIn.js";
import Client from "../models/Client.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const orgFlag = args.indexOf("--org");
const ONLY_ORG = orgFlag !== -1 ? args[orgFlag + 1] : null;

// What makes two rows "the same person in the same room", for the skip check.
const keyOf = (row) =>
  [row.tenant, row.property, row.room]
    .map((v) => String(v || "").trim().toLowerCase())
    .join("|");

const run = async () => {
  await connectDB();

  const filter = { isDeleted: false };
  if (ONLY_ORG) filter.organizationId = ONLY_ORG;

  const checkIns = await CheckIn.find(filter).lean();
  console.log(
    `Found ${checkIns.length} check-in(s)${ONLY_ORG ? ` in org ${ONLY_ORG}` : ""}` +
      `${DRY ? " (dry run)" : ""}…`
  );

  // Existing clients, so a re-run cannot duplicate anybody.
  const existing = await Client.find(
    ONLY_ORG ? { organizationId: ONLY_ORG, isDeleted: false } : { isDeleted: false }
  )
    .select("organizationId tenant property room")
    .lean();

  const seen = new Set(existing.map((c) => String(c.organizationId) + "|" + keyOf(c)));

  const docs = [];
  let skipped = 0;

  for (const ci of checkIns) {
    const key = String(ci.organizationId) + "|" + keyOf(ci);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    docs.push({
      organizationId: ci.organizationId,
      createdBy: ci.createdBy,
      propertyId: ci.propertyId || null,
      roomId: ci.roomId || null,
      property: ci.property,
      room: ci.room || "",
      roomType: ci.roomType || "",
      tenant: ci.tenant,
      email: ci.email || "",
      phone: ci.phone || "",
      gender: ci.gender || "",
      nationality: ci.nationality || "",
      // Contract dates only — the check-in's own dates stay on the check-in.
      contractStart: ci.contractStart || null,
      contractEnd: ci.contractEnd || null,
      rent: ci.rent || 0,
      deposit: ci.deposit || 0,
      paymentDueDay: ci.paymentDueDay ?? null,
      bank: ci.bank || "",
      agent: ci.agent || "",
      status: ci.status === "CHECKED_OUT" ? "PAST" : "ACTIVE",
      notes: ci.notes || "",
    });
  }

  console.log(`  ${docs.length} to copy, ${skipped} already in the client database.`);

  if (!DRY && docs.length) {
    await Client.insertMany(docs);
    console.log(`  Inserted ${docs.length} client(s).`);
  }

  await disconnectDB();
};

run().catch(async (err) => {
  console.error("Seed failed:", err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
