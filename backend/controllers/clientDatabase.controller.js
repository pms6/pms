// controllers/clientDatabase.controller.js
//
// The client database — "Database Template .xlsx" read the way the sheet
// itself reads it: one flat row per client, the property name written once and
// then left blank down its rooms, numbered by property.
//
// This register is INDEPENDENT of the check-in register. It used to be a
// read-only view over CheckIn, so every check-in appeared here automatically
// and editing a client edited their check-in; that is no longer true. Clients
// are entered here by hand, and nothing in the check-in flow reaches this
// collection. See the note at the top of models/Client.js.
//
// The only things still read from elsewhere are the property's own facts — its
// postcode and how many rooms it has — because those describe the building, not
// the client, and duplicating them here would just let them go stale.

import Property from "../models/Property.js";
import Room from "../models/Room.js";
import Client, { CLIENT_STATUSES } from "../models/Client.js";
import { contractDuration, genderAndNationality } from "../utils/duration.js";

/**
 * Whitelist of fields a client may set. Anything else on the body — including
 * organizationId and the soft-delete flags — is ignored, so a caller cannot
 * file a row into another organization or resurrect a deleted one.
 */
const EDITABLE_KEYS = [
  "propertyId",
  "roomId",
  "property",
  "room",
  "roomType",
  "tenant",
  "email",
  "phone",
  "gender",
  "nationality",
  "contractStart",
  "contractEnd",
  "rent",
  "deposit",
  "paymentDueDay",
  "bank",
  "agent",
  "status",
  "notes",
];

const NUMERIC_KEYS = ["rent", "deposit"];
const DATE_KEYS = ["contractStart", "contractEnd"];
const REF_KEYS = ["propertyId", "roomId"];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// Empty strings arrive from unset select/date inputs. Mongoose casts "" to
// null for an ObjectId path but throws for a Date, so normalise both here.
const blankToNull = (value) => (value === "" || value === undefined ? null : value);

/**
 * Validate and coerce the money, date and day fields in place. Returns an error
 * message, or null when the payload is good.
 */
const normalisePayload = (payload) => {
  for (const key of NUMERIC_KEYS) {
    if (payload[key] === undefined) continue;
    if (payload[key] === "" || payload[key] === null) {
      payload[key] = 0;
      continue;
    }
    const n = Number(payload[key]);
    if (!Number.isFinite(n) || n < 0) {
      return key + " must be a positive number.";
    }
    payload[key] = n;
  }

  if (payload.paymentDueDay !== undefined) {
    if (payload.paymentDueDay === "" || payload.paymentDueDay === null) {
      payload.paymentDueDay = null;
    } else {
      const day = Number(payload.paymentDueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return "paymentDueDay must be a day of the month (1-31).";
      }
      payload.paymentDueDay = day;
    }
  }

  for (const key of DATE_KEYS) {
    if (payload[key] !== undefined) payload[key] = blankToNull(payload[key]);
  }
  for (const key of REF_KEYS) {
    if (payload[key] !== undefined) payload[key] = blankToNull(payload[key]);
  }

  if (payload.contractStart && payload.contractEnd) {
    if (new Date(payload.contractEnd) < new Date(payload.contractStart)) {
      return "The contract end date cannot be before the start date.";
    }
  }

  if (payload.status !== undefined && !CLIENT_STATUSES.includes(payload.status)) {
    delete payload.status;
  }

  return null;
};

/**
 * Resolve the optional property/room links, and keep the denormalised names in
 * step with them. A link to another organization's record simply does not
 * resolve, which is what keeps a row from being filed across a tenant boundary.
 */
const attachLinks = async (payload, organizationId) => {
  if (payload.propertyId) {
    const property = await Property.findOne({
      _id: payload.propertyId,
      organizationId,
      isDeleted: false,
    })
      .select("name")
      .lean();
    if (!property) return { error: "That property was not found." };
    // The name is only filled in when the client did not type one: a row off
    // the spreadsheet may name the property differently from the record it is
    // being linked to, and the sheet's wording is the audit trail.
    if (!payload.property) payload.property = property.name;
  }

  if (payload.roomId) {
    const room = await Room.findOne({ _id: payload.roomId, organizationId })
      .select("roomName propertyId")
      .lean();
    if (!room) return { error: "That room was not found." };
    if (!payload.room) payload.room = room.roomName || "";
    // Keep the pair consistent: a room always belongs to its own property.
    if (!payload.propertyId) payload.propertyId = room.propertyId;
  }

  return {};
};

// Rows whose contract ends within this many days are flagged, and are what
// ?expiring=true filters to. 60 days matches the window the available-rooms
// screen already looks ahead by.
const EXPIRY_DAYS = 60;

// @desc    The client database — one row per client, in sheet order
// @route   GET /api/v1/client-database
export const getClientDatabase = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { propertyId, status, agent, bank, expiring, search } = req.query;

    // The sheet is the CURRENT client list, so live clients are the default.
    // "" asks for everyone, past clients included.
    const filter = { organizationId, isDeleted: false };
    if (status === undefined) filter.status = "ACTIVE";
    else if (status !== "") filter.status = status;

    if (propertyId) filter.propertyId = propertyId;
    if (agent) filter.agent = agent;
    if (bank) filter.bank = bank;

    const [properties, rooms, clients] = await Promise.all([
      Property.find({ organizationId, isDeleted: false })
        .select("name address rentalType")
        .sort({ name: 1 })
        .lean(),
      // Only the room count per property is needed here — the sheet's "No of
      // Rooms" column — plus each room's status for the row it belongs to.
      Room.find({ organizationId }).select("propertyId status").lean(),
      Client.find(filter).lean(),
    ]);

    const roomCountByProperty = new Map();
    const roomStatusById = new Map();
    for (const room of rooms) {
      const key = String(room.propertyId);
      roomCountByProperty.set(key, (roomCountByProperty.get(key) || 0) + 1);
      roomStatusById.set(String(room._id), room.status);
    }

    const propertyById = new Map(properties.map((p) => [String(p._id), p]));

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    let rows = clients.map((c) => {
      const propertyKey = c.propertyId ? String(c.propertyId) : "";
      const property = propertyKey ? propertyById.get(propertyKey) : null;
      const end = c.contractEnd ? new Date(c.contractEnd) : null;

      return {
        _id: String(c._id),

        // Property block — the sheet's first three columns.
        propertyId: propertyKey,
        property: c.property || property?.name || "",
        postcode: property?.address?.postcode || "",
        // "No of Rooms". Zero when the property has no room records, which is
        // true of anything typed straight off the spreadsheet.
        roomCount: roomCountByProperty.get(propertyKey) || 0,
        // "Room Status" — the room's own state, blank when there is no room
        // record to read it from.
        roomStatus: c.roomId ? roomStatusById.get(String(c.roomId)) || "" : "",

        // Client block.
        roomId: c.roomId ? String(c.roomId) : "",
        room: c.room || "",
        tenant: c.tenant,
        genderNationality: genderAndNationality(c),
        gender: c.gender || "",
        nationality: c.nationality || "",
        // The sheet's second "Room Status" column, which is really the room
        // type ("Double Room", "GA Double Room").
        roomType: c.roomType || "",
        phone: c.phone || "",
        email: c.email || "",

        // Period of contract — the only dates this register keeps.
        contractStart: c.contractStart || null,
        contractEnd: c.contractEnd || null,
        duration: contractDuration(c.contractStart, c.contractEnd),
        // Flagged rather than filtered by default: a contract running out is
        // the thing this sheet is scanned for.
        expiringSoon: Boolean(end && end >= now && end <= horizon),
        expired: Boolean(end && end < now),

        // Money.
        rent: c.rent || 0,
        deposit: c.deposit || 0,
        paymentDueDay: c.paymentDueDay ?? null,
        bank: c.bank || "",
        agent: c.agent || "",

        status: c.status,
        notes: c.notes || "",
      };
    });

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.tenant, r.property, r.room, r.email, r.phone, r.nationality, r.agent, r.bank]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      );
    }

    if (expiring === "true") {
      rows = rows.filter((r) => r.expiringSoon || r.expired);
    }

    // Sheet order: properties alphabetically, clients within a property by room
    // then name, so the block for one property reads as one block.
    rows.sort(
      (a, b) =>
        a.property.localeCompare(b.property) ||
        (a.room || "").localeCompare(b.room || "") ||
        a.tenant.localeCompare(b.tenant)
    );

    // The sheet's "Sr. No" column: numbered per property, written on that
    // property's first row only, with the name blank on the rows beneath it.
    let serial = 0;
    let lastProperty = null;
    for (const row of rows) {
      const key = row.propertyId + "|" + row.property;
      row.firstOfProperty = key !== lastProperty;
      if (row.firstOfProperty) {
        serial += 1;
        lastProperty = key;
      }
      row.serial = serial;
    }

    const sum = (key) => rows.reduce((total, r) => total + (r[key] || 0), 0);

    // Filter options drawn from every client, not just the visible rows, so
    // picking an agent cannot empty the dropdown you picked them from.
    const [agents, banks] = await Promise.all([
      Client.distinct("agent", { organizationId, isDeleted: false }),
      Client.distinct("bank", { organizationId, isDeleted: false }),
    ]);

    return res.status(200).json({
      success: true,
      total: rows.length,
      properties: properties.map((p) => ({ _id: String(p._id), name: p.name })),
      agents: agents.filter(Boolean).sort(),
      banks: banks.filter(Boolean).sort(),
      summary: {
        clients: rows.length,
        properties: new Set(rows.map((r) => r.propertyId + "|" + r.property)).size,
        rent: sum("rent"),
        deposit: sum("deposit"),
        expiringSoon: rows.filter((r) => r.expiringSoon).length,
        expired: rows.filter((r) => r.expired).length,
        expiryDays: EXPIRY_DAYS,
      },
      data: rows,
    });
  } catch (error) {
    console.error("Get Client Database Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build the client database." });
  }
};

// @desc    One client in full, as the form edits them
// @route   GET /api/v1/client-database/:id
export const getClientById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const row = await Client.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    }).lean();

    if (!row) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Client Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the client." });
  }
};

// @desc    Add a client by hand
// @route   POST /api/v1/client-database
export const createClient = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    if (!payload.property || !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "A client name is required." });
    }

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await Client.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("Create Client Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to add the client." });
  }
};

// @desc    Edit a client
// @route   PUT /api/v1/client-database/:id
export const updateClient = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    if (payload.property !== undefined && !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (payload.tenant !== undefined && !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "A client name is required." });
    }

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await Client.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Update Client Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update the client." });
  }
};

// @desc    Soft delete a client
// @route   DELETE /api/v1/client-database/:id
//
// Removes the row from this register only. No check-in, deposit or room record
// is touched — they are separate registers now.
export const deleteClient = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const row = await Client.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    return res.status(200).json({ success: true, message: "Client deleted." });
  } catch (error) {
    console.error("Delete Client Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the client." });
  }
};
