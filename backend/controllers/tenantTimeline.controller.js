// controllers/tenantTimeline.controller.js
//
// One tenant's whole history, from one place: every conversation, case,
// maintenance job, rent payment, check-in / check-out, inventory report,
// invoice, document and tenancy event, newest first.
//
// Nothing here is stored. Each of those records lives in its own collection
// and is read from there, so the timeline can never disagree with the record
// it came from and nothing is kept twice.
//
// "One tenant" means the person, not one tenancy: a renewal is a new tenancy
// record, so every tenancy with the same Tenant profile — or, where there is
// no profile, the same email — is read together.

import mongoose from "mongoose";
import Tenancy from "../models/Tenancy.js";
import EmailRecord from "../models/EmailRecord.js";
import TenantCase from "../models/TenantCase.js";
import Maintenance from "../models/Maintenance.js";
import RentCharge from "../models/RentCharge.js";
import CheckIn from "../models/CheckIn.js";
import CheckOut from "../models/CheckOut.js";
import InventoryReport from "../models/InventoryReport.js";
import Invoice from "../models/Invoice.js";
import Onboarding from "../models/Onboarding.js";

const files = (list) => (Array.isArray(list) ? list.filter((f) => f?.url) : []);

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// @desc    The tenant's timeline and every document across their records
// @route   GET /api/v1/tenancies/:id/timeline
// @access  Organization staff only
export const getTenantTimeline = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid tenant." });
    }

    const anchor = await Tenancy.findOne({ _id: req.params.id, organizationId }).lean();
    if (!anchor) return res.status(404).json({ success: false, message: "Tenant not found." });

    // Every tenancy this person has had with us.
    const same = [{ _id: anchor._id }];
    if (anchor.tenantId) same.push({ tenantId: anchor.tenantId });
    if (anchor.tenantEmail) same.push({ tenantEmail: anchor.tenantEmail });
    const tenancies = await Tenancy.find({ organizationId, $or: same }).sort({ startDate: 1 }).lean();
    const ids = tenancies.map((t) => t._id);
    const email = anchor.tenantEmail || "";

    const [emails, cases, maintenance, charges, checkIns, checkOuts, reports, invoices, onboardings] = await Promise.all([
      EmailRecord.find({
        organizationId,
        isDeleted: false,
        $or: [{ tenancyId: { $in: ids } }, ...(email ? [{ tenantEmail: email }] : [])],
      }).lean(),
      TenantCase.find({ organizationId, isDeleted: false, tenancyId: { $in: ids } }).lean(),
      // Jobs filed against the tenant, plus jobs in their room while they
      // lived there that predate the tenancy link.
      Maintenance.find({
        organizationId,
        isDeleted: false,
        $or: [
          { tenancyId: { $in: ids } },
          ...tenancies
            .filter((t) => t.roomId && t.startDate)
            .map((t) => ({
              tenancyId: null,
              roomId: t.roomId,
              date: { $gte: t.startDate, ...(t.fixedTermEnd && !["Periodic", "Becoming Periodic"].includes(t.status) ? { $lte: t.fixedTermEnd } : {}) },
            })),
        ],
      })
        .select("ref title description status priority date property room media createdAt")
        .lean(),
      RentCharge.find({ organizationId, tenancyId: { $in: ids } }).lean(),
      CheckIn.find({ organizationId, isDeleted: { $ne: true }, tenancyId: { $in: ids } }).lean(),
      CheckOut.find({ organizationId, isDeleted: { $ne: true }, tenancyId: { $in: ids } }).lean(),
      InventoryReport.find({ organizationId, isDeleted: false, tenancyId: { $in: ids } })
        .select("reference jobType status inspectionDate property room pdf finalisedAt createdAt")
        .lean(),
      Invoice.find({ organizationId, isDeleted: false, tenancyId: { $in: ids } })
        .select("number status total balance invoiceDate dueDate payments files property createdAt")
        .lean(),
      Onboarding.find({ organizationId, isDeleted: false, tenancyId: { $in: ids } }).select("documents name").lean(),
    ]);

    const events = [];
    const documents = [];
    const doc = (f, source, date, link) => documents.push({ ...f, source, date: date || f.uploadedAt || null, link });
    const push = (e) => e.date && events.push(e);

    // ---- tenancy ----
    for (const t of tenancies) {
      const where = [t.property, t.unit && t.unit !== "—" ? t.unit : ""].filter(Boolean).join(" · ");
      push({ type: "tenancy", date: t.startDate || t.createdAt, title: "Tenancy started", summary: `${where} · ${t.status}${t.rent ? ` · £${t.rent}` : ""}`, link: { type: "Tenancy", id: t._id } });
      if (t.invitedAt) push({ type: "tenancy", date: t.invitedAt, title: "Onboarding invite sent", summary: where, link: { type: "Tenancy", id: t._id } });
      if (t.fixedTermEnd) {
        push({ type: "tenancy", date: t.fixedTermEnd, title: new Date(t.fixedTermEnd) < startOfToday() ? "Fixed term ended" : "Fixed term ends", summary: where, link: { type: "Tenancy", id: t._id } });
      }
      if (t.isDeleted && t.deletedAt) push({ type: "tenancy", date: t.deletedAt, title: "Tenancy removed", summary: where, link: { type: "Tenancy", id: t._id } });
    }

    // ---- communications ----
    for (const r of emails) {
      const isNotice = r.category === "Notice";
      push({
        type: isNotice ? "notice" : "communication",
        date: r.date,
        title: `${r.channel || "Email"}${r.subject ? `: ${r.subject}` : ""}`,
        summary: r.issue,
        status: r.status,
        files: files(r.files),
        by: r.createdByEmail || "",
        link: { type: "EmailRecord", id: r._id },
      });
      files(r.files).forEach((f) => doc(f, `Communication · ${r.subject || r.issue}`, r.date, { type: "EmailRecord", id: r._id }));
      for (const h of r.history || []) {
        push({
          type: "message",
          date: h.date,
          title: `${h.channel} ${h.direction === "Incoming" ? "from tenant" : h.direction === "Internal" ? "note" : "to tenant"}`,
          summary: h.summary,
          retracted: Boolean(h.retractedAt),
          files: files(h.files),
          by: h.createdByEmail || "",
          link: { type: "EmailRecord", id: r._id },
        });
        files(h.files).forEach((f) => doc(f, `Message · ${r.subject || r.issue}`, h.date, { type: "EmailRecord", id: r._id }));
      }
    }

    // ---- cases ----
    for (const c of cases) {
      push({ type: "case", date: c.createdAt, title: `Case opened: ${c.title}`, summary: `${c.ref} · ${c.category}`, status: c.status, files: files(c.files), by: c.createdByEmail, link: { type: "TenantCase", id: c._id } });
      files(c.files).forEach((f) => doc(f, `Case ${c.ref}`, c.createdAt, { type: "TenantCase", id: c._id }));
      for (const a of c.activity || []) {
        if (a.kind === "created") continue;
        push({ type: "case_activity", date: a.createdAt, title: `${c.ref} · ${a.kind === "note" ? "Note" : a.kind === "status" ? "Status changed" : a.kind === "assignment" ? "Assigned" : "Updated"}`, summary: a.text, status: a.status || undefined, files: files(a.files), by: a.authorEmail, link: { type: "TenantCase", id: c._id } });
        files(a.files).forEach((f) => doc(f, `Case ${c.ref} · note`, a.createdAt, { type: "TenantCase", id: c._id }));
      }
    }

    // ---- maintenance ----
    for (const m of maintenance) {
      push({ type: "maintenance", date: m.date || m.createdAt, title: `Maintenance: ${m.title}`, summary: [m.ref, m.room].filter(Boolean).join(" · "), status: m.status, files: files(m.media), link: { type: "Maintenance", id: m._id } });
      files(m.media).forEach((f) => doc(f, `Maintenance ${m.ref || m.title}`, m.date, { type: "Maintenance", id: m._id }));
    }

    // ---- rent ----
    for (const ch of charges) {
      if (ch.status === "paid") {
        push({ type: "payment", date: ch.paidDate || ch.confirmedAt || ch.dueDate, title: `Rent paid · ${ch.periodKey || ""}`.trim(), summary: `£${ch.amount}${ch.method ? ` · ${ch.method}` : ""}`, status: "paid", link: { type: "RentCharge", id: ch._id } });
      } else if (ch.status === "awaiting_confirmation") {
        push({ type: "payment", date: ch.claimedAt || ch.dueDate, title: `Tenant reported rent paid · ${ch.periodKey || ""}`.trim(), summary: `£${ch.amount} awaiting confirmation`, status: "awaiting_confirmation", link: { type: "RentCharge", id: ch._id } });
      } else if (new Date(ch.dueDate) < startOfToday()) {
        push({ type: "payment", date: ch.dueDate, title: `Rent overdue · ${ch.periodKey || ""}`.trim(), summary: `£${ch.amount} unpaid`, status: "overdue", link: { type: "RentCharge", id: ch._id } });
      }
    }

    // ---- check-in / check-out ----
    for (const ci of checkIns) {
      push({ type: "check_in", date: ci.checkInDate || ci.roomRentedDate, title: "Checked in", summary: [ci.property, ci.room].filter(Boolean).join(" · "), link: { type: "CheckIn", id: ci._id } });
    }
    for (const co of checkOuts) {
      if (co.noticeDate) push({ type: "notice", date: co.noticeDate, title: "Notice given", summary: [co.property, co.room].filter(Boolean).join(" · "), link: { type: "CheckOut", id: co._id } });
      push({ type: "check_out", date: co.actualMovedOutDate || co.movedOutDate || co.createdAt, title: "Checked out", summary: `Deposit: ${String(co.depositStatus || "").replace(/_/g, " ").toLowerCase()}`, link: { type: "CheckOut", id: co._id } });
      [...files(co.photoFiles), ...files(co.videoFiles)].forEach((f) => doc(f, "Check-out", co.movedOutDate, { type: "CheckOut", id: co._id }));
    }

    // ---- inventory reports ----
    for (const ir of reports) {
      push({ type: "inventory", date: ir.inspectionDate, title: `${ir.jobType} report ${ir.reference}`, summary: [ir.property, ir.room].filter(Boolean).join(" · "), status: ir.status, link: { type: "InventoryReport", id: ir._id } });
      if (ir.pdf?.url) doc(ir.pdf, `${ir.jobType} report ${ir.reference}`, ir.finalisedAt, { type: "InventoryReport", id: ir._id });
    }

    // ---- invoices ----
    for (const inv of invoices) {
      push({ type: "invoice", date: inv.invoiceDate, title: `Invoice ${inv.number}`, summary: `£${inv.total}${inv.balance ? ` · £${inv.balance} due` : ""}`, status: inv.status, link: { type: "Invoice", id: inv._id } });
      for (const p of inv.payments || []) {
        push({ type: "invoice_payment", date: p.date, title: `Payment on ${inv.number}`, summary: `£${p.amount}${p.method ? ` · ${p.method}` : ""}`, link: { type: "Invoice", id: inv._id } });
      }
      files(inv.files).forEach((f) => doc(f, `Invoice ${inv.number}`, inv.invoiceDate, { type: "Invoice", id: inv._id }));
    }

    // ---- onboarding documents ----
    for (const ob of onboardings) {
      for (const d of ob.documents || []) {
        if (d.url) {
          doc({ name: d.name, url: d.url, type: /\.pdf(\?|$)/i.test(d.url) ? "pdf" : "file" }, `Onboarding · ${d.type || "Document"}`, d.uploadedAt, { type: "Onboarding", id: ob._id });
          push({ type: "document", date: d.uploadedAt, title: `Document: ${d.name}`, summary: d.type || "Onboarding", status: d.status, link: { type: "Onboarding", id: ob._id } });
        }
      }
    }

    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    documents.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return res.status(200).json({
      success: true,
      data: {
        tenancyIds: ids.map(String),
        tenancies: tenancies.map((t) => ({ _id: t._id, property: t.property, unit: t.unit, startDate: t.startDate, fixedTermEnd: t.fixedTermEnd, status: t.status, isDeleted: t.isDeleted })),
        counts: {
          communications: emails.length,
          cases: cases.length,
          openCases: cases.filter((c) => !["Resolved", "Closed"].includes(c.status)).length,
          maintenance: maintenance.length,
          invoices: invoices.length,
          inventory: reports.length,
          documents: documents.length,
        },
        events,
        documents,
      },
    });
  } catch (error) {
    console.error("Tenant Timeline Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the tenant's history." });
  }
};
