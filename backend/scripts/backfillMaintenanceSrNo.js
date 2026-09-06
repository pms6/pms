/**
 * One-off backfill for the Maintenance Booklet's "Sr#" column.
 *
 * Rows written before `srNo` existed have `srNo: null`, so the booklet falls
 * back to showing their position in the list. This stamps a permanent number on
 * them, per organisation, in booklet order (date, then creation time).
 *
 * Soft-deleted rows are numbered too — the booklet never reuses a Sr#.
 *
 *   node scripts/backfillMaintenanceSrNo.js            # fill only missing numbers
 *   node scripts/backfillMaintenanceSrNo.js --dry      # preview, write nothing
 *   node scripts/backfillMaintenanceSrNo.js --renumber # renumber every row 1..n
 *
 * Safe to re-run: without --renumber it only touches rows that have no Sr#.
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";
import Maintenance from "../models/Maintenance.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const RENUMBER = args.includes("--renumber");

// Booklet order: oldest issue first, ties broken by creation time then _id so
// repeated runs always produce the same numbering.
const bookletOrder = (a, b) =>
  new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0) ||
  new Date(a.createdAt || 0) - new Date(b.createdAt || 0) ||
  String(a._id).localeCompare(String(b._id));

const run = async () => {
  await connectDB();

  const orgIds = await Maintenance.distinct("organizationId");
  console.log(
    `Scanning ${orgIds.length} organisation(s)${DRY ? " (dry run)" : ""}${RENUMBER ? " — full renumber" : ""}…`
  );

  let scanned = 0;
  let assigned = 0;

  for (const organizationId of orgIds) {
    const docs = await Maintenance.find({ organizationId })
      .select("_id srNo date createdAt title")
      .lean();

    scanned += docs.length;

    const ops = [];

    if (RENUMBER) {
      // Every row in the org gets a fresh number, 1..n, in booklet order.
      docs.sort(bookletOrder).forEach((doc, i) => {
        const srNo = i + 1;
        if (doc.srNo === srNo) return;
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { srNo } } } });
      });
    } else {
      // Keep numbers already handed out; append the unnumbered rows after the
      // highest one in use.
      let next = docs.reduce((max, d) => (typeof d.srNo === "number" && d.srNo > max ? d.srNo : max), 0);

      docs
        .filter((d) => typeof d.srNo !== "number")
        .sort(bookletOrder)
        .forEach((doc) => {
          next += 1;
          ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { srNo: next } } } });
        });
    }

    if (ops.length === 0) continue;
    assigned += ops.length;

    console.log(`  org ${organizationId}: ${ops.length} of ${docs.length} row(s) to number`);
    if (!DRY) await Maintenance.bulkWrite(ops, { ordered: false });
  }

  console.log(
    DRY
      ? `Dry run complete — ${assigned} of ${scanned} row(s) would be numbered. Re-run without --dry to apply.`
      : `Done — numbered ${assigned} of ${scanned} row(s).`
  );

  await disconnectDB();
};

run().catch(async (err) => {
  console.error("Backfill failed:", err);
  if (mongoose.connection.readyState === 1) await disconnectDB();
  process.exit(1);
});
