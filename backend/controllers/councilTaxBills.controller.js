// controllers/councilTaxBills.controller.js
//
// The Council Tax and Bills section: two registers that share one page — the
// council tax sheet and the bills record. They are separate collections
// because they are separate sheets with different columns, but they behave the
// same, so the handlers are built by one factory (as in garden.controller.js).
import CouncilTax from "../models/CouncilTax.js";
import BillRecord from "../models/BillRecord.js";
import { cleanAttachments } from "../utils/attachments.js";
import { sendCouncilTaxReminders } from "../cranjob/councilTaxReminder.js";

const validationMessage = (error) =>
  Object.values(error.errors).map((e) => e.message).join(", ");

const text = (v) => String(v ?? "").trim();

// "" and null both mean "no date" — Mongoose would cast "" to an Invalid Date.
const dateOrNull = (v) => (v === "" || v === null ? null : v);

// A blank cell stays blank (null) rather than becoming £0.
const moneyOrNull = (v) => {
  if (v === "" || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// The fields both sheets share: the property and its optional portfolio link.
const pickCommon = (body, payload) => {
  if (body.propertyId !== undefined) payload.propertyId = body.propertyId || null;
  if (body.property !== undefined) payload.property = text(body.property);
};

/* ------------------------------------------------------------------ *
 * Council tax
 * ------------------------------------------------------------------ */
// More than a bill ever lists (councils offer 10 or 12 a year) — a ceiling so a
// bad request can't store an unbounded array.
const MAX_INSTALLMENTS = 60;

// Rows left entirely blank in the form are dropped rather than stored.
const cleanInstallments = (list) =>
  (Array.isArray(list) ? list : [])
    .map((i) => ({
      amount: moneyOrNull(i?.amount ?? null),
      dueDate: dateOrNull(i?.dueDate ?? null),
      paidAt: dateOrNull(i?.paidAt ?? null),
      files: cleanAttachments(i?.files),
    }))
    .filter((i) => i.amount !== null || i.dueDate || i.paidAt || i.files.length)
    .slice(0, MAX_INSTALLMENTS);

const pickCouncilTax = (body) => {
  const payload = {};
  pickCommon(body, payload);
  for (const key of ["councilName", "accountHolder", "accountNumber", "email", "details"]) {
    if (body[key] !== undefined) payload[key] = text(body[key]);
  }
  if (body.moveInDate !== undefined) payload.moveInDate = dateOrNull(body.moveInDate);
  for (const key of ["totalAmount", "firstInstallment", "secondInstallment"]) {
    if (body[key] !== undefined) payload[key] = moneyOrNull(body[key]);
  }
  if (body.status !== undefined) payload.status = text(body.status);
  if (body.paidAt !== undefined) payload.paidAt = dateOrNull(body.paidAt);
  if (body.installments !== undefined) {
    const list = cleanInstallments(body.installments);
    payload.installments = list;
    // The two legacy columns mirror the list, so a row never reads one thing
    // from them and another from its instalments.
    payload.firstInstallment = list[0]?.amount ?? null;
    payload.secondInstallment = list[1]?.amount ?? null;
    // With instalments the model derives the status; with none there is
    // nothing to be paid or pending.
    if (list.length === 0) payload.status = "";
  }
  if (body.files !== undefined) payload.files = cleanAttachments(body.files);
  return payload;
};

/* ------------------------------------------------------------------ *
 * Bills record
 * ------------------------------------------------------------------ */
const pickBill = (body) => {
  const payload = {};
  pickCommon(body, payload);
  for (const key of ["type", "paymentName", "status", "bill", "notes"]) {
    if (body[key] !== undefined) payload[key] = text(body[key]);
  }
  if (body.date !== undefined) payload.date = dateOrNull(body.date);
  if (body.amount !== undefined) payload.amount = moneyOrNull(body.amount);
  if (body.billFiles !== undefined) payload.billFiles = cleanAttachments(body.billFiles);
  return payload;
};

/* ------------------------------------------------------------------ *
 * One set of handlers per sheet
 * ------------------------------------------------------------------ */
const buildHandlers = ({ Model, pick, noun, sort }) => ({
  list: async (req, res) => {
    try {
      const filter = { organizationId: req.user.organizationId, isDeleted: false };
      if (req.query.propertyId) filter.propertyId = req.query.propertyId;

      const rows = await Model.find(filter).sort(sort);
      return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
      console.error(`List ${noun} Error:`, error);
      return res.status(500).json({ success: false, message: `Failed to fetch ${noun}.` });
    }
  },

  create: async (req, res) => {
    try {
      const payload = pick(req.body);

      if (!payload.property) {
        return res.status(400).json({ success: false, message: "Property is required." });
      }

      const row = await Model.create({
        ...payload,
        organizationId: req.user.organizationId,
        createdBy: req.user._id,
      });

      return res.status(201).json({ success: true, message: `${noun} added.`, data: row });
    } catch (error) {
      console.error(`Create ${noun} Error:`, error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ success: false, message: validationMessage(error) });
      }
      return res.status(500).json({ success: false, message: `Failed to add ${noun}.` });
    }
  },

  update: async (req, res) => {
    try {
      const row = await Model.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
        isDeleted: false,
      });

      if (!row) {
        return res.status(404).json({ success: false, message: `${noun} not found.` });
      }

      const payload = pick(req.body);
      if (payload.property !== undefined && !payload.property) {
        return res.status(400).json({ success: false, message: "Property is required." });
      }

      Object.assign(row, payload);
      const updated = await row.save();

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error(`Update ${noun} Error:`, error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ success: false, message: validationMessage(error) });
      }
      return res.status(500).json({ success: false, message: `Failed to update ${noun}.` });
    }
  },

  remove: async (req, res) => {
    try {
      const row = await Model.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
        isDeleted: false,
      });

      if (!row) {
        return res.status(404).json({ success: false, message: `${noun} not found.` });
      }

      row.isDeleted = true;
      row.deletedAt = new Date();
      await row.save();

      return res.status(200).json({ success: true, message: `${noun} deleted.` });
    } catch (error) {
      console.error(`Delete ${noun} Error:`, error);
      return res.status(500).json({ success: false, message: `Failed to delete ${noun}.` });
    }
  },
});

// Council tax reads alphabetically by property; bills newest first.
export const councilTax = buildHandlers({
  Model: CouncilTax,
  pick: pickCouncilTax,
  noun: "Council tax entry",
  sort: { property: 1, createdAt: 1 },
});

export const bills = buildHandlers({
  Model: BillRecord,
  pick: pickBill,
  noun: "Bill record",
  sort: { date: -1, property: 1, createdAt: -1 },
});

// @desc    Send this organization's council tax "payment due" reminders now,
//          rather than waiting for the 8am run. Same once-per-due-date rule,
//          so pressing it twice sends nothing new the second time.
// @route   POST /api/v1/council-tax-bills/council-tax/send-reminders
export const sendCouncilTaxRemindersNow = async (req, res) => {
  try {
    const result = await sendCouncilTaxReminders({ organizationId: req.user.organizationId });
    if (result.errors.length && !result.sentCount) {
      return res.status(502).json({
        success: false,
        message: `Reminders could not be sent: ${result.errors[0].error}`,
      });
    }
    return res.status(200).json({
      success: true,
      message: result.instalments
        ? `Reminder sent for ${result.instalments} instalment${result.instalments === 1 ? "" : "s"}.`
        : "Nothing new to remind about — every due instalment has already been reminded.",
      data: result,
    });
  } catch (error) {
    console.error("Send Council Tax Reminders Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send reminders." });
  }
};
