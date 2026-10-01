// controllers/invoice.controller.js
//
// Customised invoices — see models/Invoice.js.
//
//   Draft ──issue──▶ Issued ──payments──▶ Partially Paid ──▶ Paid
//     │                 │
//     └── delete        └── cancel ──▶ Cancelled
//
// Totals are always recalculated here from the line items; the client's
// figures are never stored. Once issued, the line items are fixed — a wrong
// invoice is cancelled and replaced, the way an accountant would want it.

import mongoose from "mongoose";
import Invoice, { INVOICE_STATUSES, BILL_TO_TYPES } from "../models/Invoice.js";
import Organization from "../models/Organization.js";
import Property from "../models/Property.js";
import Tenancy from "../models/Tenancy.js";
import Owner from "../models/Owner.js";
import TenantCase from "../models/TenantCase.js";
import { nextSeq } from "../models/Counter.js";
import { cleanAttachments } from "../utils/attachments.js";
import { sendEmail } from "../utils/sendEmail.js";
import { buildInvoicePdf } from "../utils/pdf/invoicePdf.js";
import { fmtMoney, fmtDate } from "../utils/pdf/common.js";

const ADMIN_ROLES = ["OWNER", "ADMIN"];
const isAdmin = (req) => ADMIN_ROLES.includes(req.user?.organizationRole);

const text = (v, max = 5000) => String(v ?? "").trim().slice(0, max);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const oid = (v) => (v && mongoose.isValidObjectId(v) ? String(v) : null);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const orgFilter = (req, extra = {}) => ({
  organizationId: req.user.organizationId,
  isDeleted: false,
  ...extra,
});

const log = (req, action, note = "") => ({
  action,
  note,
  at: new Date(),
  by: req.user._id,
  byEmail: req.user.email || "",
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const OPEN = ["Issued", "Partially Paid"];

// "Overdue" is worked out, not stored: an open invoice past its due date.
export const effectiveStatus = (inv) =>
  OPEN.includes(inv.status) && inv.dueDate && new Date(inv.dueDate) < startOfToday() ? "Overdue" : inv.status;

const withStatus = (inv) => ({ ...inv, effectiveStatus: effectiveStatus(inv) });

// Line totals → subtotal, discount, VAT, total, paid, balance. The discount
// comes off before VAT, spread across the lines in proportion, which is how
// HMRC expects a pre-VAT discount to be treated.
export const computeTotals = (inv) => {
  const nets = (inv.lineItems || []).map((li) => num(li.quantity) * num(li.unitPrice));
  const subtotal = round2(nets.reduce((a, b) => a + b, 0));
  const discountAmount = round2(
    Math.min(
      Math.max(inv.discountType === "percent" ? (subtotal * num(inv.discountValue)) / 100 : num(inv.discountValue), 0),
      Math.max(subtotal, 0)
    )
  );
  const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
  const vatTotal = round2(
    (inv.lineItems || []).reduce((sum, li, i) => sum + (nets[i] * num(li.vatRate)) / 100, 0) * ratio
  );
  const total = round2(subtotal - discountAmount + vatTotal);
  const amountPaid = round2((inv.payments || []).reduce((s, p) => s + num(p.amount), 0));
  inv.subtotal = subtotal;
  inv.discountAmount = discountAmount;
  inv.vatTotal = vatTotal;
  inv.total = total;
  inv.amountPaid = amountPaid;
  inv.balance = round2(Math.max(total - amountPaid, 0));
  return inv;
};

// After a payment is added or removed, an issued invoice moves between
// Issued / Partially Paid / Paid by itself.
const settleStatus = (inv) => {
  if (!["Issued", "Partially Paid", "Paid"].includes(inv.status)) return;
  if (inv.total > 0 && inv.amountPaid >= inv.total - 0.005) {
    inv.status = "Paid";
    inv.paidAt = inv.paidAt || new Date();
  } else if (inv.amountPaid > 0) {
    inv.status = "Partially Paid";
    inv.paidAt = null;
  } else {
    inv.status = "Issued";
    inv.paidAt = null;
  }
};

const cleanLines = (list) =>
  (Array.isArray(list) ? list : [])
    .map((li) => ({
      ...(oid(li._id) ? { _id: li._id } : {}),
      description: text(li.description, 1000),
      quantity: Math.max(num(li.quantity, 1), 0),
      unitPrice: round2(num(li.unitPrice)),
      vatRate: Math.min(Math.max(num(li.vatRate), 0), 100),
    }))
    .filter((li) => li.description);

// The organisation's company and payment details, as the invoice prints them.
const issuerFor = async (organizationId) => {
  const org = await Organization.findById(organizationId).select("name legalName address phone logo invoiceSettings").lean();
  const s = org?.invoiceSettings || {};
  return {
    name: org?.name || org?.legalName || "",
    legalName: org?.legalName || "",
    address: org?.address || "",
    phone: org?.phone || "",
    logo: org?.logo || "",
    email: s.email || "",
    website: s.website || "",
    vatNumber: s.vatNumber || "",
    companyNumber: s.companyNumber || "",
    bankName: s.bankName || "",
    accountName: s.accountName || "",
    sortCode: s.sortCode || "",
    accountNumber: s.accountNumber || "",
    iban: s.iban || "",
    swift: s.swift || "",
    paymentInstructions: s.paymentInstructions || "",
    footer: s.footer || "",
    // Not printed — used for defaults.
    _prefix: s.prefix || "INV-",
    _vat: num(s.defaultVatRate),
    _terms: s.paymentTermsDays ?? 14,
  };
};

const printable = ({ _prefix, _vat, _terms, ...issuer }) => issuer;

// Who and what the invoice is for. Throws a 400-worthy message for anything
// outside the caller's organisation.
const resolveParties = async (organizationId, b, current = {}) => {
  const out = {};
  const type = b.billToType !== undefined ? pick(b.billToType, BILL_TO_TYPES, "Other") : current.billToType || "Tenant";
  out.billToType = type;
  const billTo = { ...(current.billTo || {}), ...(b.billTo || {}) };

  out.tenancyId = null;
  out.ownerId = null;

  if (type === "Tenant") {
    const id = b.tenancyId !== undefined ? oid(b.tenancyId) : current.tenancyId;
    if (!id) throw new Error("Pick the tenant this invoice is for.");
    const t = await Tenancy.findOne({ _id: id, organizationId }).select("tenant tenantEmail property unit propertyId").lean();
    if (!t) throw new Error("Tenant not found in this organization.");
    out.tenancyId = t._id;
    // Defaults from the tenancy; anything typed on the form wins.
    if (!text(billTo.name) || b.tenancyId !== undefined) billTo.name = text(b.billTo?.name) || t.tenant || "";
    if (!text(billTo.email) || b.tenancyId !== undefined) billTo.email = text(b.billTo?.email) || t.tenantEmail || "";
    if (!text(billTo.address) || b.tenancyId !== undefined) {
      billTo.address = text(b.billTo?.address) || [t.unit && t.unit !== "—" ? t.unit : "", t.property].filter(Boolean).join(", ");
    }
    if (b.propertyId === undefined && !current.propertyId && t.propertyId) b = { ...b, propertyId: t.propertyId };
  } else if (type === "Landlord") {
    const id = b.ownerId !== undefined ? oid(b.ownerId) : current.ownerId;
    if (!id) throw new Error("Pick the landlord this invoice is for.");
    const o = await Owner.findOne({ _id: id, organizationId }).select("name email phone").lean();
    if (!o) throw new Error("Landlord not found in this organization.");
    out.ownerId = o._id;
    if (!text(billTo.name) || b.ownerId !== undefined) billTo.name = text(b.billTo?.name) || o.name || "";
    if (!text(billTo.email) || b.ownerId !== undefined) billTo.email = text(b.billTo?.email) || o.email || "";
  }

  out.billTo = { name: text(billTo.name, 300), email: text(billTo.email, 300).toLowerCase(), address: text(billTo.address, 1000) };
  if (!out.billTo.name) throw new Error("Who is the invoice to? Enter a name.");

  const propertyId = b.propertyId !== undefined ? oid(b.propertyId) : current.propertyId;
  if (propertyId) {
    const p = await Property.findOne({ _id: propertyId, organizationId, isDeleted: false }).select("name").lean();
    if (!p) throw new Error("Property not found.");
    out.propertyId = p._id;
    out.property = p.name || "";
  } else {
    out.propertyId = null;
    out.property = "";
  }

  const caseId = b.caseId !== undefined ? oid(b.caseId) : current.caseId;
  if (caseId) {
    if (!(await TenantCase.exists({ _id: caseId, organizationId, isDeleted: false }))) throw new Error("Case not found.");
    out.caseId = caseId;
  } else out.caseId = null;

  return out;
};

// @desc    Vocabularies and the organisation's invoice defaults
// @route   GET /api/v1/invoices/options
export const getInvoiceOptions = async (req, res) => {
  try {
    const issuer = await issuerFor(req.user.organizationId);
    return res.status(200).json({
      success: true,
      data: {
        statuses: INVOICE_STATUSES,
        billToTypes: BILL_TO_TYPES,
        defaultVatRate: issuer._vat,
        paymentTermsDays: issuer._terms,
        prefix: issuer._prefix,
        issuer: printable(issuer),
      },
    });
  } catch (error) {
    console.error("Invoice Options Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load invoice settings." });
  }
};

// @desc    Searchable invoice history
// @route   GET /api/v1/invoices
export const getInvoices = async (req, res) => {
  try {
    const q = req.query;
    const filter = orgFilter(req);
    const today = startOfToday();

    if (q.status === "Overdue") {
      filter.status = { $in: OPEN };
      filter.dueDate = { $lt: today };
    } else if (q.status === "Outstanding") {
      filter.status = { $in: OPEN };
    } else if (OPEN.includes(q.status)) {
      filter.status = q.status;
      filter.$or = [{ dueDate: null }, { dueDate: { $gte: today } }];
    } else if (INVOICE_STATUSES.includes(q.status)) {
      filter.status = q.status;
    }
    if (oid(q.propertyId)) filter.propertyId = q.propertyId;
    if (q.tenancyIds) filter.tenancyId = { $in: String(q.tenancyIds).split(",").filter(oid) };
    else if (oid(q.tenancyId)) filter.tenancyId = q.tenancyId;
    if (oid(q.ownerId)) filter.ownerId = q.ownerId;
    if (oid(q.caseId)) filter.caseId = q.caseId;
    if (BILL_TO_TYPES.includes(q.billToType)) filter.billToType = q.billToType;
    if (q.from || q.to) {
      filter.invoiceDate = {};
      if (q.from) filter.invoiceDate.$gte = new Date(q.from);
      if (q.to) filter.invoiceDate.$lte = new Date(q.to);
    }
    if (q.q) {
      const rx = new RegExp(String(q.q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const or = [{ number: rx }, { "billTo.name": rx }, { "billTo.email": rx }, { property: rx }, { "lineItems.description": rx }, { notes: rx }];
      filter.$and = [{ $or: or }];
    }

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);

    const orgMatch = { organizationId: new mongoose.Types.ObjectId(String(req.user.organizationId)), isDeleted: false };
    const [rows, total, summary] = await Promise.all([
      Invoice.find(filter).select("-history -issuer").sort({ invoiceDate: -1, seq: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: { ...orgMatch, status: { $in: OPEN } } },
        {
          $group: {
            _id: null,
            outstanding: { $sum: "$balance" },
            count: { $sum: 1 },
            overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$dueDate", null] }, { $lt: ["$dueDate", today] }] }, "$balance", 0] } },
            overdueCount: { $sum: { $cond: [{ $and: [{ $ne: ["$dueDate", null] }, { $lt: ["$dueDate", today] }] }, 1, 0] } },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      total,
      page,
      limit,
      summary: summary[0] || { outstanding: 0, count: 0, overdue: 0, overdueCount: 0 },
      data: rows.map(withStatus),
    });
  } catch (error) {
    console.error("Get Invoices Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch invoices." });
  }
};

// @route   GET /api/v1/invoices/:id
export const getInvoice = async (req, res) => {
  try {
    const row = await Invoice.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!row) return res.status(404).json({ success: false, message: "Invoice not found." });
    return res.status(200).json({ success: true, data: withStatus(row) });
  } catch (error) {
    console.error("Get Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the invoice." });
  }
};

const snapshotIssuer = async (inv) => {
  inv.issuer = printable(await issuerFor(inv.organizationId));
};

// @desc    Create an invoice (a draft, or issued straight away with issue:true)
// @route   POST /api/v1/invoices
export const createInvoice = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const b = req.body || {};
    const lineItems = cleanLines(b.lineItems);
    if (!lineItems.length) return res.status(400).json({ success: false, message: "Add at least one line item." });

    let parties;
    try {
      parties = await resolveParties(organizationId, b);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const issuer = await issuerFor(organizationId);
    const invoiceDate = b.invoiceDate ? new Date(b.invoiceDate) : new Date();
    const dueDate = b.dueDate
      ? new Date(b.dueDate)
      : new Date(invoiceDate.getTime() + Number(issuer._terms || 0) * 86400000);

    const seq = await nextSeq(organizationId, "invoice");
    const inv = new Invoice({
      organizationId,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      number: `${issuer._prefix}${String(seq).padStart(5, "0")}`,
      seq,
      status: "Draft",
      invoiceDate,
      dueDate,
      ...parties,
      lineItems,
      discountType: pick(b.discountType, ["amount", "percent"], "amount"),
      discountValue: Math.max(num(b.discountValue), 0),
      notes: text(b.notes),
      terms: text(b.terms),
      files: cleanAttachments(b.files),
      history: [log(req, "Created")],
    });
    computeTotals(inv);

    if (b.issue) {
      inv.status = "Issued";
      inv.issuedAt = new Date();
      await snapshotIssuer(inv);
      inv.history.push(log(req, "Issued"));
    }

    await inv.save();
    return res.status(201).json({ success: true, message: b.issue ? `Invoice ${inv.number} issued.` : `Draft ${inv.number} saved.`, data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Create Invoice Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join(", ") });
    }
    return res.status(500).json({ success: false, message: "Failed to create the invoice." });
  }
};

// @desc    Edit. A draft is fully editable; an issued invoice only its notes,
//          terms, due date and attachments.
// @route   PUT /api/v1/invoices/:id
export const updateInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    const b = req.body || {};

    if (inv.status === "Draft") {
      if (b.lineItems !== undefined) {
        const lines = cleanLines(b.lineItems);
        if (!lines.length) return res.status(400).json({ success: false, message: "Add at least one line item." });
        inv.lineItems = lines;
      }
      if (b.invoiceDate) inv.invoiceDate = new Date(b.invoiceDate);
      if (b.discountType !== undefined) inv.discountType = pick(b.discountType, ["amount", "percent"], "amount");
      if (b.discountValue !== undefined) inv.discountValue = Math.max(num(b.discountValue), 0);
      if (["billToType", "tenancyId", "ownerId", "billTo", "propertyId", "caseId"].some((k) => b[k] !== undefined)) {
        try {
          inv.set(await resolveParties(req.user.organizationId, b, inv.toObject()));
        } catch (e) {
          return res.status(400).json({ success: false, message: e.message });
        }
      }
    } else if (["lineItems", "discountValue", "discountType", "billTo", "tenancyId", "ownerId", "invoiceDate"].some((k) => b[k] !== undefined)) {
      return res.status(409).json({
        success: false,
        message: "An issued invoice's amounts and recipient are fixed. Cancel it and raise a new one instead.",
      });
    }

    if (b.dueDate !== undefined) inv.dueDate = b.dueDate ? new Date(b.dueDate) : null;
    if (b.notes !== undefined) inv.notes = text(b.notes);
    if (b.terms !== undefined) inv.terms = text(b.terms);
    if (b.files !== undefined) inv.files = cleanAttachments(b.files);
    // An issued invoice can still be linked to a case after the fact.
    if (b.caseId !== undefined && inv.status !== "Draft") {
      const caseId = oid(b.caseId);
      if (caseId && !(await TenantCase.exists({ _id: caseId, organizationId: req.user.organizationId, isDeleted: false }))) {
        return res.status(400).json({ success: false, message: "Case not found." });
      }
      inv.caseId = caseId;
    }

    computeTotals(inv);
    inv.history.push(log(req, "Edited"));
    await inv.save();
    return res.status(200).json({ success: true, message: "Invoice saved.", data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Update Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save the invoice." });
  }
};

// @route   POST /api/v1/invoices/:id/issue
export const issueInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    if (inv.status !== "Draft") return res.status(409).json({ success: false, message: "Only a draft can be issued." });
    if (!inv.lineItems.length) return res.status(400).json({ success: false, message: "Add at least one line item." });
    inv.status = "Issued";
    inv.issuedAt = new Date();
    await snapshotIssuer(inv);
    computeTotals(inv);
    settleStatus(inv);
    inv.history.push(log(req, "Issued"));
    await inv.save();
    return res.status(200).json({ success: true, message: `Invoice ${inv.number} issued.`, data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Issue Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to issue the invoice." });
  }
};

// @route   POST /api/v1/invoices/:id/payments
export const addPayment = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    if (!["Issued", "Partially Paid"].includes(inv.status)) {
      return res.status(409).json({ success: false, message: inv.status === "Draft" ? "Issue the invoice before recording a payment." : `A ${inv.status.toLowerCase()} invoice cannot take payments.` });
    }
    const amount = round2(num(req.body?.amount));
    if (!(amount > 0)) return res.status(400).json({ success: false, message: "Enter the amount received." });
    if (amount > inv.balance + 0.005) {
      return res.status(400).json({ success: false, message: `That is more than the ${fmtMoney(inv.balance)} still due.` });
    }
    inv.payments.push({
      amount,
      date: req.body?.date ? new Date(req.body.date) : new Date(),
      method: text(req.body?.method, 100),
      reference: text(req.body?.reference, 200),
      note: text(req.body?.note, 1000),
      recordedBy: req.user._id,
      recordedByEmail: req.user.email || "",
    });
    computeTotals(inv);
    settleStatus(inv);
    inv.history.push(log(req, "Payment recorded", fmtMoney(amount)));
    await inv.save();
    return res.status(201).json({ success: true, message: `Payment of ${fmtMoney(amount)} recorded.`, data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Add Invoice Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to record the payment." });
  }
};

// @desc    Remove a payment recorded in error (owner / admin only; logged)
// @route   DELETE /api/v1/invoices/:id/payments/:paymentId
export const removePayment = async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Only an owner or admin can remove a payment." });
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    const p = inv.payments.id(req.params.paymentId);
    if (!p) return res.status(404).json({ success: false, message: "Payment not found." });
    const note = `${fmtMoney(p.amount)} on ${fmtDate(p.date)}${p.reference ? ` (${p.reference})` : ""}`;
    p.deleteOne();
    computeTotals(inv);
    settleStatus(inv);
    inv.history.push(log(req, "Payment removed", note));
    await inv.save();
    return res.status(200).json({ success: true, message: "Payment removed.", data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Remove Invoice Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove the payment." });
  }
};

// @route   POST /api/v1/invoices/:id/cancel
export const cancelInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    if (inv.status === "Cancelled") return res.status(409).json({ success: false, message: "Already cancelled." });
    if (inv.status === "Paid") return res.status(409).json({ success: false, message: "A paid invoice cannot be cancelled." });
    inv.status = "Cancelled";
    inv.cancelledAt = new Date();
    inv.history.push(log(req, "Cancelled", text(req.body?.reason, 500)));
    await inv.save();
    return res.status(200).json({ success: true, message: `Invoice ${inv.number} cancelled.`, data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Cancel Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel the invoice." });
  }
};

// @desc    Delete a draft. Issued invoices are cancelled, never deleted, so the
//          numbering has no unexplained gaps.
// @route   DELETE /api/v1/invoices/:id
export const deleteInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    if (inv.status !== "Draft") {
      return res.status(409).json({ success: false, message: "Only a draft can be deleted — cancel an issued invoice instead." });
    }
    inv.isDeleted = true;
    inv.deletedAt = new Date();
    inv.history.push(log(req, "Deleted"));
    await inv.save();
    return res.status(200).json({ success: true, message: "Draft deleted." });
  } catch (error) {
    console.error("Delete Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the invoice." });
  }
};

const renderFor = async (inv) => {
  const plain = typeof inv.toObject === "function" ? inv.toObject() : inv;
  // A draft prints the current settings; an issued invoice what it was issued with.
  const issuer = plain.issuer?.name !== undefined && plain.status !== "Draft"
    ? plain.issuer
    : printable(await issuerFor(plain.organizationId));
  return buildInvoicePdf(withStatus(plain), issuer);
};

// @route   GET /api/v1/invoices/:id/pdf
export const getInvoicePdf = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    const pdf = await renderFor(inv);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="Invoice-${inv.number}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error("Invoice PDF Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate the PDF." });
  }
};

const escapeHtml = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// @desc    Email the invoice PDF to the payer (or any address given)
// @route   POST /api/v1/invoices/:id/send
export const sendInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findOne(orgFilter(req, { _id: req.params.id }));
    if (!inv) return res.status(404).json({ success: false, message: "Invoice not found." });
    if (inv.status === "Draft") return res.status(409).json({ success: false, message: "Issue the invoice before sending it." });
    if (inv.status === "Cancelled") return res.status(409).json({ success: false, message: "A cancelled invoice cannot be sent." });

    const to = text(req.body?.to, 300) || inv.billTo?.email;
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to || "")) {
      return res.status(400).json({ success: false, message: "Enter a valid email address to send to." });
    }

    const pdf = await renderFor(inv);
    const company = inv.issuer?.name || "";
    const message = text(req.body?.message, 5000);
    await sendEmail({
      email: to,
      subject: `Invoice ${inv.number}${company ? ` from ${company}` : ""}`,
      html: `<p>Dear ${escapeHtml(inv.billTo?.name || "Sir/Madam")},</p>
        ${message ? `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}
        <p>Please find attached invoice <strong>${escapeHtml(inv.number)}</strong> for <strong>${escapeHtml(fmtMoney(inv.balance || inv.total))}</strong>${inv.dueDate ? `, due by ${escapeHtml(fmtDate(inv.dueDate))}` : ""}.</p>
        <p>Kind regards,<br>${escapeHtml(company)}</p>`,
      attachments: [{ filename: `Invoice-${inv.number}.pdf`, content: pdf, contentType: "application/pdf" }],
      ...(inv.issuer?.email ? { replyTo: inv.issuer.email } : {}),
    });

    inv.lastSentAt = new Date();
    inv.lastSentTo = to;
    inv.history.push(log(req, "Emailed", to));
    await inv.save();
    return res.status(200).json({ success: true, message: `Invoice emailed to ${to}.`, data: withStatus(inv.toObject()) });
  } catch (error) {
    console.error("Send Invoice Error:", error);
    return res.status(500).json({ success: false, message: "The invoice could not be emailed. Check the mail settings and try again." });
  }
};
