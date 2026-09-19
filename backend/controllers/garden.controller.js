// controllers/garden.controller.js
//
// The Garden section: two registers that share one page — the garden cutting
// log and the garden machines sheet. They are separate collections because
// they are separate sheets with different columns, but they behave the same,
// so the handlers are built by one factory rather than written out twice.
import GardenCutting from "../models/GardenCutting.js";
import GardenMachine, { GARDEN_MACHINE_ITEMS } from "../models/GardenMachine.js";
import { cleanAttachments } from "../utils/attachments.js";

const validationMessage = (error) =>
  Object.values(error.errors).map((e) => e.message).join(", ");

// The fields both sheets share: the property, its optional link to the
// portfolio, and free-text notes.
const pickCommon = (body, payload) => {
  if (body.propertyId !== undefined) payload.propertyId = body.propertyId || null;
  if (body.property !== undefined) payload.property = String(body.property ?? "").trim();
  if (body.notes !== undefined) payload.notes = String(body.notes ?? "").trim();
};

/* ------------------------------------------------------------------ *
 * Garden cutting
 * ------------------------------------------------------------------ */
const pickCutting = (body) => {
  const payload = {};
  pickCommon(body, payload);
  if (body.date !== undefined) payload.date = body.date;
  if (body.name !== undefined) payload.name = String(body.name ?? "").trim();
  if (body.cost !== undefined) {
    const cost = Number(body.cost);
    payload.cost = Number.isFinite(cost) && cost > 0 ? cost : 0;
  }
  if (body.beforeFiles !== undefined) payload.beforeFiles = cleanAttachments(body.beforeFiles);
  if (body.afterFiles !== undefined) payload.afterFiles = cleanAttachments(body.afterFiles);
  return payload;
};

/* ------------------------------------------------------------------ *
 * Garden machines
 * ------------------------------------------------------------------ */
const pickMachine = (body) => {
  const payload = {};
  pickCommon(body, payload);
  for (const key of GARDEN_MACHINE_ITEMS) {
    const item = body[key];
    if (item === undefined || item === null || typeof item !== "object") continue;
    payload[key] = {
      value: String(item.value ?? "").trim(),
      files: cleanAttachments(item.files),
    };
  }
  return payload;
};

/* ------------------------------------------------------------------ *
 * One set of handlers per sheet
 * ------------------------------------------------------------------ */
const buildHandlers = ({ Model, pick, noun, sort }) => ({
  list: async (req, res) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(401).json({ success: false, message: "Organization ID required" });
      }

      const filter = { organizationId, isDeleted: false };
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
      if (Model === GardenCutting && !payload.date) {
        return res.status(400).json({ success: false, message: "Date is required." });
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

// Newest cut first; machines read alphabetically by property.
export const cutting = buildHandlers({
  Model: GardenCutting,
  pick: pickCutting,
  noun: "Garden cutting entry",
  sort: { date: -1, property: 1 },
});

export const machines = buildHandlers({
  Model: GardenMachine,
  pick: pickMachine,
  noun: "Garden machines entry",
  sort: { property: 1, createdAt: -1 },
});
