// controllers/payment.controller.js
import RentCharge from "../models/RentCharge.js";
import Tenancy from "../models/Tenancy.js";

const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Same year + month?
const sameMonth = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Derive a charge's status from its due date. "paid" is final, and a charge
// awaiting an operator's confirmation must not be dragged back to due/overdue
// underneath them.
function computeStatus(charge, today) {
  if (charge.status === "paid") return "paid";
  if (charge.status === "awaiting_confirmation") return "awaiting_confirmation";
  const due = new Date(charge.dueDate);
  if (due > today) return "upcoming";
  if (sameMonth(due, today)) return "due";
  return "overdue";
}

// Lazily create any monthly charges that don't exist yet for this tenancy, from
// the tenancy start month through NEXT month (so there's always an upcoming one).
async function ensureCharges(tenancy) {
  const rent = Number(tenancy.rent) || 0;
  const start = tenancy.startDate ? new Date(tenancy.startDate) : null;
  if (!start || Number.isNaN(start.getTime()) || rent <= 0) return;

  const today = new Date();
  const anchorDay = start.getDate();

  // A tenancy that has rolled onto a periodic basis keeps billing; one still on
  // a fixed term stops at the end of that term. Without this a tenancy that
  // ended months ago carries on generating charges forever.
  const rolledOn =
    tenancy.status === "Periodic" || tenancy.status === "Becoming Periodic";
  const termEnd =
    !rolledOn && tenancy.fixedTermEnd ? new Date(tenancy.fixedTermEnd) : null;
  const validTermEnd = termEnd && !Number.isNaN(termEnd.getTime()) ? termEnd : null;

  // Anchor day clamped to the target month's length: a tenancy starting on the
  // 31st must fall due on 30 September, not 1 October.
  const dueOn = (year, month) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(anchorDay, lastDay));
  };

  // Build the list of billing periods (1st-of-month cursors).
  const periods = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endBound = new Date(today.getFullYear(), today.getMonth() + 1, 1); // include next month
  let guard = 0;
  while (cursor <= endBound && guard < 72) {
    // Stop once the billing month starts after the term ends. Comparing the
    // month start (not the due date) keeps the final part-month billed — a
    // tenancy ending on the 24th with rent due on the 31st still owes that
    // month, and would otherwise generate no charges at all.
    if (validTermEnd && cursor > validTermEnd) break;
    const due = dueOn(cursor.getFullYear(), cursor.getMonth());
    periods.push({ key: monthKey(cursor), due });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    guard++;
  }

  const existing = await RentCharge.find({ tenancyId: tenancy._id })
    .select("periodKey")
    .lean();
  const have = new Set(existing.map((c) => c.periodKey));

  const toCreate = periods
    .filter((p) => !have.has(p.key))
    .map((p) => ({
      organizationId: tenancy.organizationId,
      tenancyId: tenancy._id,
      tenantEmail: (tenancy.tenantEmail || "").toLowerCase(),
      property: tenancy.property || "",
      room: tenancy.unit && tenancy.unit !== "—" ? tenancy.unit : "",
      amount: rent,
      periodKey: p.key,
      dueDate: p.due,
      status: p.due > today ? "upcoming" : "due",
      method: "",
      paidDate: null,
    }));

  if (toCreate.length) {
    // ordered:false so a concurrent duplicate (unique index) doesn't abort the batch.
    try {
      await RentCharge.insertMany(toCreate, { ordered: false });
    } catch (err) {
      if (err.code !== 11000) throw err; // ignore duplicate-key races
    }
  }
}

// @desc    The signed-in tenant's rent charges + summary (for the Payments page)
// @route   GET /api/v1/payments/my
// @access  Private (Tenant)
export const getMyPayments = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    const empty = {
      success: true,
      data: { charges: [], summary: { monthlyRent: 0, nextDueDate: null, balance: 0 } },
    };
    if (!email) return res.status(200).json(empty);

    const tenancy = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!tenancy) return res.status(200).json(empty);

    await ensureCharges(tenancy);

    const today = new Date();
    const charges = await RentCharge.find({ tenancyId: tenancy._id })
      .sort({ dueDate: -1 })
      .lean();

    // Re-derive due/overdue/upcoming for unpaid charges and persist any changes
    // so the stored ledger stays accurate as time passes.
    const updates = [];
    for (const c of charges) {
      const next = computeStatus(c, today);
      if (next !== c.status) {
        c.status = next;
        updates.push({
          updateOne: { filter: { _id: c._id }, update: { $set: { status: next } } },
        });
      }
    }
    if (updates.length) await RentCharge.bulkWrite(updates);

    // Summary cards.
    const unpaid = charges.filter((c) => c.status !== "paid");
    const balance = charges
      .filter((c) => c.status === "due" || c.status === "overdue")
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    // Next due = soonest unpaid charge on/after today, else the earliest unpaid.
    const futureUnpaid = unpaid
      .filter((c) => new Date(c.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const anyUnpaid = [...unpaid].sort(
      (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
    );
    const nextDueDate =
      futureUnpaid[0]?.dueDate || anyUnpaid[0]?.dueDate || null;

    return res.status(200).json({
      success: true,
      data: {
        charges,
        summary: {
          monthlyRent: Number(tenancy.rent) || 0,
          nextDueDate,
          balance,
        },
      },
    });
  } catch (error) {
    console.error("Get My Payments Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load your payments." });
  }
};

// @desc    Record a payment against one of the tenant's own rent charges
// @route   POST /api/v1/payments/:id/pay
// @access  Private (Tenant)
export const payCharge = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();

    const charge = await RentCharge.findById(req.params.id);
    if (!charge || charge.tenantEmail !== email) {
      return res.status(404).json({ success: false, message: "Charge not found." });
    }

    if (charge.status === "paid") {
      return res.status(200).json({ success: true, message: "Already paid.", data: charge });
    }

    if (charge.status === "awaiting_confirmation") {
      return res.status(200).json({
        success: true,
        message: "Already reported — waiting for your operator to confirm.",
        data: charge,
      });
    }

    // This records the tenant's CLAIM, not a payment. No money moves here and
    // nothing verifies it, so marking the charge "paid" would let a tenant
    // clear their own balance. An operator confirms it below.
    charge.status = "awaiting_confirmation";
    charge.claimedAt = new Date();
    charge.claimedMethod = req.body?.method || "Bank Transfer";
    await charge.save();

    return res.status(200).json({
      success: true,
      message: "Payment reported. Your operator will confirm it.",
      data: charge,
    });
  } catch (error) {
    console.error("Pay Charge Error:", error);
    return res.status(500).json({ success: false, message: "Failed to report payment." });
  }
};

// @desc    Operator confirms (or rejects) a tenant's reported payment.
// @route   PATCH /api/v1/payments/:id/confirm   body: { confirm: true|false }
// @access  Private (organization member)
export const confirmCharge = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }
    if (req.user.role === "Tenant") {
      return res.status(403).json({
        success: false,
        message: "Only your operator can confirm a payment.",
      });
    }

    const confirm = req.body?.confirm !== false;

    const charge = await RentCharge.findOne({ _id: req.params.id, organizationId });
    if (!charge) {
      return res.status(404).json({ success: false, message: "Charge not found." });
    }

    if (confirm) {
      charge.status = "paid";
      charge.paidDate = charge.claimedAt || new Date();
      charge.method = charge.claimedMethod || req.body?.method || "Bank Transfer";
      charge.confirmedBy = req.user._id;
      charge.confirmedAt = new Date();
    } else {
      // Rejected — hand it back to the ledger, which re-derives due/overdue.
      charge.status = computeStatus({ ...charge.toObject(), status: "due" }, new Date());
      charge.claimedAt = null;
      charge.claimedMethod = "";
      charge.confirmedBy = req.user._id;
      charge.confirmedAt = new Date();
    }

    await charge.save();

    return res.status(200).json({
      success: true,
      message: confirm ? "Payment confirmed." : "Payment rejected.",
      data: charge,
    });
  } catch (error) {
    console.error("Confirm Charge Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the charge." });
  }
};
