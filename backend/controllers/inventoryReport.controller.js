// controllers/inventoryReport.controller.js
//
// Inventory Reports — the professional check-in / check-out document (see
// models/InventoryReport.js), its room / area templates, and its PDF.

import mongoose from "mongoose";
import InventoryReport, { JOB_TYPES, ROW_CONDITIONS, SIGNATURE_ROLES } from "../models/InventoryReport.js";
import InventoryTemplate from "../models/InventoryTemplate.js";
import Property from "../models/Property.js";
import Room from "../models/room.js";
import Tenancy from "../models/Tenancy.js";
import CheckIn from "../models/CheckIn.js";
import CheckOut from "../models/CheckOut.js";
import Organization from "../models/Organization.js";
import { nextSeq, formatRef } from "../models/Counter.js";
import { cleanAttachments } from "../utils/attachments.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryMirror.js";
import { buildInventoryReportPdf } from "../utils/pdf/inventoryReportPdf.js";
import { fileSlug, fmtShortDate } from "../utils/pdf/common.js";
import {
  AREA_TYPES,
  AREA_LABELS,
  BUILT_IN_TEMPLATES,
  SCHEDULE_OF_CONDITION,
  DEFAULT_METERS,
  SCHEDULE_NOTE,
  KEY_EXCHANGE_NOTE,
  SIGNATURE_NOTE,
  DEFAULT_DISCLAIMER,
  withCompany,
} from "../utils/inventoryTemplates.js";

const ADMIN_ROLES = ["OWNER", "ADMIN"];
const isAdmin = (req) => ADMIN_ROLES.includes(req.user?.organizationRole);

const str = (v, max = 4000) => String(v ?? "").trim().slice(0, max);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const oid = (v) => (v && mongoose.isValidObjectId(v) ? v : null);

const orgFilter = (req, extra = {}) => ({
  organizationId: req.user.organizationId,
  isDeleted: false,
  ...extra,
});

const addressLine = (a) =>
  !a ? "" : [a.line1, a.line2, a.area, a.city, a.postcode].filter(Boolean).join(", ");

const roomLabel = (room) =>
  [room?.roomNumber ? `Room ${room.roomNumber}` : "", room?.roomName, room?.title]
    .filter(Boolean)
    .join(" · ") || "Room";

const logEntry = (req, action, note = "") => ({
  action,
  note,
  at: new Date(),
  by: req.user._id,
  byEmail: req.user.email || "",
});

// The company block on the cover: name, contact details and logo from Settings.
const companyFor = async (organizationId) => {
  const org = await Organization.findById(organizationId)
    .select("name legalName phone address logo invoiceSettings.email")
    .lean();
  return {
    name: org?.name || org?.legalName || "",
    phone: org?.phone || "",
    address: org?.address || "",
    logo: org?.logo || "",
    email: org?.invoiceSettings?.email || "",
  };
};

// ---------------------------------------------------------------------------
// Cleaning — everything the editor sends is reshaped field by field.
// ---------------------------------------------------------------------------

const cleanRow = (r = {}) => ({
  ...(oid(r._id) ? { _id: r._id } : {}),
  item: str(r.item, 300),
  description: str(r.description),
  condition: pick(r.condition, ROW_CONDITIONS, ""),
  conditionComments: str(r.conditionComments),
  checkInComments: str(r.checkInComments),
  checkOutComments: str(r.checkOutComments),
  additional: Boolean(r.additional),
  photos: cleanAttachments(r.photos),
});

const cleanSection = (s = {}) => ({
  ...(oid(s._id) ? { _id: s._id } : {}),
  title: str(s.title, 200) || "Area",
  areaType: pick(s.areaType, AREA_TYPES, "OTHER"),
  roomId: oid(s.roomId),
  notes: str(s.notes),
  rows: (Array.isArray(s.rows) ? s.rows : []).map(cleanRow).filter((r) => r.item || r.description || r.photos.length),
  photos: cleanAttachments(s.photos),
});

const cleanMeters = (list) =>
  (Array.isArray(list) ? list : []).map((m) => ({
    type: str(m.type, 100),
    reading: str(m.reading, 100),
    serialNumber: str(m.serialNumber, 200),
    location: str(m.location, 200),
    keyType: str(m.keyType, 200),
    photos: cleanAttachments(m.photos),
  }));

const cleanSchedule = (list) =>
  (Array.isArray(list) ? list : [])
    .map((r) => ({ group: str(r.group, 100), subject: str(r.subject, 200), comment: str(r.comment) }))
    .filter((r) => r.subject);

const cleanSignatures = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((s) => SIGNATURE_ROLES.includes(s?.role))
    .map((s) => ({
      role: s.role,
      name: str(s.name, 200),
      date: s.date ? new Date(s.date) : null,
      imageUrl: str(s.imageUrl, 2000),
      imagePublicId: str(s.imagePublicId, 300),
    }));

// The editable fields of a report, from a request body. Only fields actually
// sent are returned, so a partial save never blanks the rest.
const pickEditable = (b = {}) => {
  const p = {};
  if (b.jobType !== undefined) p.jobType = pick(b.jobType, JOB_TYPES, "Check In");
  if (b.inspectionDate !== undefined && b.inspectionDate) p.inspectionDate = new Date(b.inspectionDate);
  for (const k of ["preparedBy", "instructedBy", "propertyType", "propertyAddress", "scheduleSubject"]) {
    if (b[k] !== undefined) p[k] = str(b[k], 500);
  }
  for (const k of ["generalNotes", "scheduleNote", "keyExchangeNote", "signatureNote"]) {
    if (b[k] !== undefined) p[k] = str(b[k], 6000);
  }
  if (b.disclaimer !== undefined) p.disclaimer = str(b.disclaimer, 20000);
  if (b.scheduleOfCondition !== undefined) p.scheduleOfCondition = cleanSchedule(b.scheduleOfCondition);
  if (b.meterReadings !== undefined) p.meterReadings = cleanMeters(b.meterReadings);
  if (b.sections !== undefined) p.sections = (Array.isArray(b.sections) ? b.sections : []).map(cleanSection);
  if (b.keys !== undefined) {
    p.keys = {
      sets: str(b.keys?.sets, 100),
      count: str(b.keys?.count, 100),
      notes: str(b.keys?.notes, 2000),
      photos: cleanAttachments(b.keys?.photos),
    };
  }
  if (b.signatures !== undefined) p.signatures = cleanSignatures(b.signatures);
  if (b.files !== undefined) p.files = cleanAttachments(b.files);
  return p;
};

// Resolves the property / room / tenancy / register links for a report and
// copies their display names in. Throws a 400-worthy message on anything
// outside the caller's organization.
const resolveLinks = async (organizationId, b, current = {}) => {
  const out = {};

  const propertyId = b.propertyId !== undefined ? oid(b.propertyId) : current.propertyId;
  const tenancyId = b.tenancyId !== undefined ? oid(b.tenancyId) : current.tenancyId;
  let roomId = b.roomId !== undefined ? oid(b.roomId) : current.roomId;

  let tenancy = null;
  if (tenancyId) {
    tenancy = await Tenancy.findOne({ _id: tenancyId, organizationId }).select("tenant tenantEmail propertyId roomId").lean();
    if (!tenancy) throw new Error("Tenant not found in this organization.");
    if (!roomId && tenancy.roomId) roomId = tenancy.roomId;
  }

  const pid = propertyId || tenancy?.propertyId;
  if (!pid) throw new Error("Pick the property this report is for.");
  const property = await Property.findOne({ _id: pid, organizationId, isDeleted: false })
    .select("name address rentalType")
    .lean();
  if (!property) throw new Error("Property not found.");

  out.propertyId = property._id;
  out.property = property.name || "";
  if (b.propertyAddress === undefined && !current.propertyAddress) out.propertyAddress = addressLine(property.address) || property.name || "";

  if (roomId) {
    const room = await Room.findOne({ _id: roomId, organizationId, propertyId: property._id, isDeleted: { $ne: true } })
      .select("roomName roomNumber title")
      .lean();
    if (!room) throw new Error("That room does not belong to this property.");
    out.roomId = room._id;
    out.room = roomLabel(room);
  } else {
    out.roomId = null;
    out.room = "";
  }

  out.tenancyId = tenancy?._id || null;
  out.tenantName = tenancy?.tenant || "";
  out.tenantEmail = tenancy?.tenantEmail || "";

  if (b.checkInId !== undefined) {
    out.checkInId = oid(b.checkInId);
    if (out.checkInId && !(await CheckIn.exists({ _id: out.checkInId, organizationId }))) throw new Error("Check-in record not found.");
  }
  if (b.checkOutId !== undefined) {
    out.checkOutId = oid(b.checkOutId);
    if (out.checkOutId && !(await CheckOut.exists({ _id: out.checkOutId, organizationId }))) throw new Error("Check-out record not found.");
  }

  return out;
};

// Built-in + this organisation's own templates, in one list.
const templatesFor = async (organizationId) => {
  const own = await InventoryTemplate.find({ organizationId, isDeleted: false }).sort({ name: 1 }).lean();
  return [
    ...BUILT_IN_TEMPLATES.map((t) => ({ ...t, builtIn: true })),
    ...own.map((t) => ({ key: `org:${t._id}`, _id: t._id, areaType: t.areaType, name: t.name, items: t.items, builtIn: false })),
  ];
};

const CONDITION_FROM_ASSET = { NEW: "GOOD", GOOD: "GOOD", FAIR: "FAIR", POOR: "POOR" };

// One asset-list item (Property/Room.inventory.items) as a report row.
const rowFromAsset = (it) => ({
  item: str(it.item, 300),
  description: [Number(it.quantity) > 1 ? `${it.quantity}x` : "", it.location, it.notes].filter(Boolean).join(" · "),
  condition: CONDITION_FROM_ASSET[it.condition] || "",
  photos: (it.images || []).filter((i) => i?.url).map((i) => ({ url: i.url, publicId: i.publicId || "", type: "image", name: "" })),
});

// @desc    Templates, vocabularies and the default wording the editor needs
// @route   GET /api/v1/inventory-reports/options
export const getReportOptions = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        jobTypes: JOB_TYPES,
        areaTypes: AREA_TYPES.map((k) => ({ key: k, label: AREA_LABELS[k] })),
        templates: await templatesFor(req.user.organizationId),
      },
    });
  } catch (error) {
    console.error("Inventory Report Options Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load inventory templates." });
  }
};

// @desc    Save an organisation template
// @route   POST /api/v1/inventory-reports/templates
export const createTemplate = async (req, res) => {
  try {
    const name = str(req.body.name, 200);
    if (!name) return res.status(400).json({ success: false, message: "Template name is required." });
    const t = await InventoryTemplate.create({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      name,
      areaType: pick(req.body.areaType, AREA_TYPES, "OTHER"),
      items: (Array.isArray(req.body.items) ? req.body.items : [])
        .map((i) => ({ item: str(i.item, 300), description: str(i.description) }))
        .filter((i) => i.item || i.description),
    });
    return res.status(201).json({ success: true, message: "Template saved.", data: t });
  } catch (error) {
    console.error("Create Inventory Template Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save template." });
  }
};

// @route   PUT /api/v1/inventory-reports/templates/:id
export const updateTemplate = async (req, res) => {
  try {
    const t = await InventoryTemplate.findOne(orgFilter(req, { _id: req.params.id }));
    if (!t) return res.status(404).json({ success: false, message: "Template not found." });
    if (req.body.name !== undefined) t.name = str(req.body.name, 200) || t.name;
    if (req.body.areaType !== undefined) t.areaType = pick(req.body.areaType, AREA_TYPES, t.areaType);
    if (req.body.items !== undefined) {
      t.items = (Array.isArray(req.body.items) ? req.body.items : [])
        .map((i) => ({ item: str(i.item, 300), description: str(i.description) }))
        .filter((i) => i.item || i.description);
    }
    await t.save();
    return res.status(200).json({ success: true, message: "Template updated.", data: t });
  } catch (error) {
    console.error("Update Inventory Template Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update template." });
  }
};

// @route   DELETE /api/v1/inventory-reports/templates/:id
export const deleteTemplate = async (req, res) => {
  try {
    const r = await InventoryTemplate.updateOne(orgFilter(req, { _id: req.params.id }), { $set: { isDeleted: true } });
    if (!r.matchedCount) return res.status(404).json({ success: false, message: "Template not found." });
    return res.status(200).json({ success: true, message: "Template removed." });
  } catch (error) {
    console.error("Delete Inventory Template Error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove template." });
  }
};

// @desc    List reports (no item rows — just the summary each card needs)
// @route   GET /api/v1/inventory-reports
export const getReports = async (req, res) => {
  try {
    const q = req.query;
    const filter = orgFilter(req);
    if (oid(q.propertyId)) filter.propertyId = q.propertyId;
    if (oid(q.roomId)) filter.roomId = q.roomId;
    if (q.tenancyIds) {
      const ids = String(q.tenancyIds).split(",").filter(oid);
      filter.tenancyId = { $in: ids };
    } else if (oid(q.tenancyId)) filter.tenancyId = q.tenancyId;
    if (JOB_TYPES.includes(q.jobType)) filter.jobType = q.jobType;
    if (["Draft", "Final"].includes(q.status)) filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100), "i");
      filter.$or = [{ reference: rx }, { property: rx }, { room: rx }, { tenantName: rx }, { preparedBy: rx }];
    }

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);

    const [rows, total] = await Promise.all([
      InventoryReport.find(filter)
        .select("reference jobType status propertyId property propertyAddress roomId room tenancyId tenantName inspectionDate preparedBy finalisedAt pdf sections.title sections.rows._id createdAt updatedAt")
        .sort({ inspectionDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InventoryReport.countDocuments(filter),
    ]);

    const data = rows.map(({ sections = [], ...r }) => ({
      ...r,
      areaCount: sections.length,
      itemCount: sections.reduce((n, s) => n + (s.rows?.length || 0), 0),
      areas: sections.map((s) => s.title),
    }));

    return res.status(200).json({ success: true, count: data.length, total, page, limit, data });
  } catch (error) {
    console.error("Get Inventory Reports Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch inventory reports." });
  }
};

// @route   GET /api/v1/inventory-reports/:id
export const getReport = async (req, res) => {
  try {
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Inventory Report Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the inventory report." });
  }
};

// @desc    Start a report from templates. `areas` is [{ templateKey, title,
//          roomId }] in the order they should appear; `seedFromAssetList`
//          adds the property's / rooms' existing inventory items.
// @route   POST /api/v1/inventory-reports
export const createReport = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const b = req.body || {};

    let links;
    try {
      links = await resolveLinks(organizationId, b);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const templates = await templatesFor(organizationId);
    const byKey = new Map(templates.map((t) => [t.key, t]));

    const areas = Array.isArray(b.areas) && b.areas.length ? b.areas : [];
    const sections = areas.map((a) => {
      const t = byKey.get(a.templateKey) || byKey.get("builtin:OTHER");
      return {
        title: str(a.title, 200) || t.name,
        areaType: pick(a.areaType, AREA_TYPES, t.areaType),
        roomId: oid(a.roomId),
        rows: (t.items || []).map((i) => ({ item: i.item, description: i.description })),
        photos: [],
      };
    });

    // The existing asset list, brought in so nothing already recorded against
    // the property or room has to be typed twice.
    if (b.seedFromAssetList) {
      const property = await Property.findById(links.propertyId).select("inventory").lean();
      const roomIds = [...new Set([links.roomId, ...sections.map((s) => s.roomId)].filter(Boolean).map(String))];
      const rooms = roomIds.length
        ? await Room.find({ _id: { $in: roomIds }, organizationId }).select("inventory roomName roomNumber title").lean()
        : [];

      for (const room of rooms) {
        let section = sections.find((s) => String(s.roomId || "") === String(room._id));
        if (!section && String(links.roomId || "") === String(room._id)) {
          section = sections.find((s) => ["BEDROOM", "EN_SUITE"].includes(s.areaType)) || null;
        }
        const items = (room.inventory?.items || []).filter((it) => it.item);
        if (!items.length) continue;
        if (!section) {
          section = { title: roomLabel(room), areaType: "BEDROOM", roomId: room._id, rows: [], photos: [] };
          sections.push(section);
        }
        section.rows.push(...items.map(rowFromAsset));
      }

      const propItems = (property?.inventory?.items || []).filter((it) => it.item);
      for (const it of propItems) {
        const loc = String(it.location || "").toLowerCase();
        let section = loc && sections.find((s) => s.title.toLowerCase().includes(loc) || loc.includes(s.title.toLowerCase()));
        if (!section) {
          section = sections.find((s) => s.title === "Other Items");
          if (!section) {
            section = { title: "Other Items", areaType: "OTHER", roomId: null, rows: [], photos: [] };
            sections.push(section);
          }
        }
        section.rows.push(rowFromAsset(it));
      }
    }

    const company = await companyFor(organizationId);
    const seq = await nextSeq(organizationId, "inventoryReport");
    const jobType = pick(b.jobType, JOB_TYPES, "Check In");

    const row = await InventoryReport.create({
      organizationId,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      reference: formatRef("IR-", seq),
      jobType,
      ...links,
      inspectionDate: b.inspectionDate ? new Date(b.inspectionDate) : new Date(),
      preparedBy: str(b.preparedBy, 200) || req.user.email || "",
      instructedBy: str(b.instructedBy, 200),
      propertyType: str(b.propertyType, 200),
      generalNotes: str(b.generalNotes, 6000),
      scheduleSubject: jobType === "Check Out" ? "End of Tenancy" : jobType === "Check In" ? "Start of Tenancy" : "",
      scheduleOfCondition: SCHEDULE_OF_CONDITION.map((s) => ({ ...s, comment: "" })),
      scheduleNote: withCompany(SCHEDULE_NOTE, company.name),
      meterReadings: DEFAULT_METERS.map((m) => ({ ...m, photos: [] })),
      sections,
      keyExchangeNote: KEY_EXCHANGE_NOTE,
      signatureNote: withCompany(SIGNATURE_NOTE, company.name),
      signatures: SIGNATURE_ROLES.map((role) => ({ role, name: role === "Tenant" ? links.tenantName : "" })),
      disclaimer: withCompany(DEFAULT_DISCLAIMER, company.name),
      history: [logEntry(req, "Created", `${jobType} report started`)],
    });

    return res.status(201).json({ success: true, message: "Inventory report started.", data: row });
  } catch (error) {
    console.error("Create Inventory Report Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join(", ") });
    }
    return res.status(500).json({ success: false, message: "Failed to start the inventory report." });
  }
};

// @desc    Save the editor. A finalised report is locked — reopen it first.
// @route   PUT /api/v1/inventory-reports/:id
export const updateReport = async (req, res) => {
  try {
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    if (row.status === "Final") {
      return res.status(409).json({ success: false, message: "This report is finalised. Reopen it to make changes." });
    }

    const b = req.body || {};
    const edits = pickEditable(b);

    if (["propertyId", "roomId", "tenancyId", "checkInId", "checkOutId"].some((k) => b[k] !== undefined)) {
      try {
        Object.assign(edits, await resolveLinks(req.user.organizationId, b, row.toObject()));
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    row.set(edits);
    await row.save();

    return res.status(200).json({ success: true, message: "Report saved.", data: row });
  } catch (error) {
    console.error("Update Inventory Report Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join(", ") });
    }
    return res.status(500).json({ success: false, message: "Failed to save the report." });
  }
};

const pdfFilename = (row) =>
  `${fileSlug(row.jobType)}-${fileSlug(row.propertyAddress || row.property)}-${fmtShortDate(row.inspectionDate).replace(/\//g, ".")}-${row.reference}.pdf`;

// @desc    The report as a PDF, generated from the record as it stands
// @route   GET /api/v1/inventory-reports/:id/pdf
export const getReportPdf = async (req, res) => {
  try {
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    const pdf = await buildInventoryReportPdf(row, await companyFor(req.user.organizationId));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download ? "attachment" : "inline"}; filename="${pdfFilename(row)}"`
    );
    return res.send(pdf);
  } catch (error) {
    console.error("Inventory Report PDF Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate the PDF." });
  }
};

// @desc    Finalise: lock the report, generate its PDF, and file the PDF in
//          Cloudinary and on the property's documents.
// @route   POST /api/v1/inventory-reports/:id/finalise
export const finaliseReport = async (req, res) => {
  try {
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    if (row.status === "Final") return res.status(409).json({ success: false, message: "Already finalised." });
    if (!row.sections.length || !row.sections.some((s) => s.rows.length)) {
      return res.status(400).json({ success: false, message: "Add at least one area with items before finalising." });
    }

    const pdf = await buildInventoryReportPdf(row.toObject(), await companyFor(req.user.organizationId));
    const filename = pdfFilename(row);
    const stored = await uploadBufferToCloudinary(pdf, { filename });

    row.status = "Final";
    row.finalisedAt = new Date();
    row.finalisedBy = req.user._id;
    row.pdf = stored;
    row.history.push(logEntry(req, "Finalised", stored ? "PDF filed with the property" : "PDF could not be uploaded — it can still be downloaded"));
    await row.save();

    // Filed with the property's own documents, so it sits beside the contract
    // and the rest of the property's paperwork.
    if (stored) {
      await Property.updateOne(
        { _id: row.propertyId, organizationId: row.organizationId },
        {
          $push: {
            documents: {
              name: `${row.jobType} ${row.reference}${row.room ? ` – ${row.room}` : ""} (${fmtShortDate(row.inspectionDate)})`,
              url: stored.url,
              type: "INVENTORY",
              uploadedAt: new Date(),
            },
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: stored
        ? "Report finalised and filed with the property."
        : "Report finalised. The PDF could not be stored online — use Download to keep a copy.",
      data: row,
    });
  } catch (error) {
    console.error("Finalise Inventory Report Error:", error);
    return res.status(500).json({ success: false, message: "Failed to finalise the report." });
  }
};

// @desc    Unlock a finalised report for correction (owner / admin only)
// @route   POST /api/v1/inventory-reports/:id/reopen
export const reopenReport = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only an owner or admin can reopen a finalised report." });
    }
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    if (row.status !== "Final") return res.status(409).json({ success: false, message: "The report is not finalised." });
    row.status = "Draft";
    row.history.push(logEntry(req, "Reopened", str(req.body?.reason, 500)));
    await row.save();
    return res.status(200).json({ success: true, message: "Report reopened for editing.", data: row });
  } catch (error) {
    console.error("Reopen Inventory Report Error:", error);
    return res.status(500).json({ success: false, message: "Failed to reopen the report." });
  }
};

// @desc    Start a Check Out report from this one: every area and row carried
//          across with its condition and check-in comments, ready for the
//          check-out column — how the reference report was compiled.
// @route   POST /api/v1/inventory-reports/:id/check-out
export const createCheckOutFrom = async (req, res) => {
  try {
    const src = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!src) return res.status(404).json({ success: false, message: "Inventory report not found." });

    const organizationId = req.user.organizationId;
    const seq = await nextSeq(organizationId, "inventoryReport");
    // eslint-disable-next-line no-unused-vars
    const strip = ({ _id, __v, createdAt, updatedAt, ...rest }) => rest;

    const row = await InventoryReport.create({
      ...strip(src),
      reference: formatRef("IR-", seq),
      jobType: "Check Out",
      status: "Draft",
      sourceReportId: src._id,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      inspectionDate: req.body?.inspectionDate ? new Date(req.body.inspectionDate) : new Date(),
      preparedBy: str(req.body?.preparedBy, 200) || req.user.email || "",
      generalNotes: `A previous ${src.jobType} report (${src.reference}) dated ${fmtShortDate(src.inspectionDate)} was used as a basis and comparison to compile this Check Out report.`,
      scheduleSubject: "End of Tenancy",
      scheduleOfCondition: (src.scheduleOfCondition || []).map((s) => ({ ...s, comment: "" })),
      meterReadings: (src.meterReadings || []).map((m) => ({ ...m, reading: "", photos: [] })),
      sections: (src.sections || []).map((s) => ({
        ...strip(s),
        rows: (s.rows || []).map((r) => ({
          ...strip(r),
          // What was seen going in becomes the check-in comment, if the source
          // did not already have one.
          checkInComments: r.checkInComments || r.conditionComments || "",
          checkOutComments: "",
        })),
      })),
      keys: { sets: "", count: "", notes: "", photos: [] },
      signatures: SIGNATURE_ROLES.map((role) => ({ role, name: role === "Tenant" ? src.tenantName : "" })),
      checkOutId: oid(req.body?.checkOutId),
      finalisedAt: null,
      finalisedBy: null,
      pdf: null,
      history: [logEntry(req, "Created", `Check Out started from ${src.reference}`)],
    });

    return res.status(201).json({ success: true, message: "Check Out report started.", data: row });
  } catch (error) {
    console.error("Create Check Out From Report Error:", error);
    return res.status(500).json({ success: false, message: "Failed to start the check-out report." });
  }
};

// @desc    Remove a report. A finalised one is part of the property's record,
//          so only an owner / admin may remove it.
// @route   DELETE /api/v1/inventory-reports/:id
export const deleteReport = async (req, res) => {
  try {
    const row = await InventoryReport.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Inventory report not found." });
    if (row.status === "Final" && !isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only an owner or admin can delete a finalised report." });
    }
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.history.push(logEntry(req, "Deleted"));
    await row.save();
    return res.status(200).json({ success: true, message: "Inventory report deleted." });
  } catch (error) {
    console.error("Delete Inventory Report Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the report." });
  }
};
