// controllers/clientDatabase.controller.js
//
// The client database — "Database Template .xlsx" read the way the sheet
// itself reads it: one flat row per client, the property name written once and
// then left blank down its rooms, numbered by property.
//
// The room status list already renders the same records grouped by property and
// keyed on room state; this is the same data as a client roster, which is the
// view the office actually works from. Both are read-only views over CheckIn,
// Property and Room — nothing here is stored a second time.

import Property from "../models/Property.js";
import Room from "../models/Room.js";
import CheckIn from "../models/CheckIn.js";
import ReferenceData from "../models/ReferenceData.js";
import { contractDuration, genderAndNationality } from "../utils/duration.js";

// @desc    The client database — one row per client, in sheet order
// @route   GET /api/v1/client-database
export const getClientDatabase = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { propertyId, status, agent, bank, expiring, search } = req.query;

    // The sheet is the CURRENT client list, so live occupants are the default.
    // "" asks for everyone, past tenants included.
    const checkInFilter = { organizationId, isDeleted: false };
    if (status === undefined) checkInFilter.status = "ACTIVE";
    else if (status !== "") checkInFilter.status = status;

    if (propertyId) checkInFilter.propertyId = propertyId;
    if (agent) checkInFilter.agent = agent;
    if (bank) checkInFilter.bank = bank;

    const [properties, rooms, checkIns, referenced] = await Promise.all([
      Property.find({ organizationId, isDeleted: false })
        .select("name address rentalType")
        .sort({ name: 1 })
        .lean(),
      // Only the room count per property is needed here — the sheet's "No of
      // Rooms" column — plus each room's status for the row it belongs to.
      Room.find({ organizationId }).select("propertyId status").lean(),
      CheckIn.find(checkInFilter).lean(),
      // Which clients have a reference record, so the sheet can show the gap
      // rather than making somebody cross-check two screens.
      ReferenceData.distinct("checkInId", { organizationId, isDeleted: false }),
    ]);

    const roomCountByProperty = new Map();
    const roomStatusById = new Map();
    for (const room of rooms) {
      const key = String(room.propertyId);
      roomCountByProperty.set(key, (roomCountByProperty.get(key) || 0) + 1);
      roomStatusById.set(String(room._id), room.status);
    }

    const propertyById = new Map(properties.map((p) => [String(p._id), p]));
    const hasReferences = new Set(referenced.filter(Boolean).map(String));

    // Rows carrying a contract that ends within this many days are flagged, and
    // are what ?expiring=true filters to. 60 days matches the window the
    // available-rooms screen already looks ahead by.
    const EXPIRY_DAYS = 60;
    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    let rows = checkIns.map((ci) => {
      const propertyKey = ci.propertyId ? String(ci.propertyId) : "";
      const property = propertyKey ? propertyById.get(propertyKey) : null;
      const end = ci.contractEnd ? new Date(ci.contractEnd) : null;

      return {
        _id: String(ci._id),
        checkInId: String(ci._id),

        // Property block — the sheet's first three columns.
        propertyId: propertyKey,
        property: ci.property || property?.name || "",
        postcode: property?.address?.postcode || "",
        // "No of Rooms". Zero when the property has no room records, which is
        // true of anything typed straight off the spreadsheet.
        roomCount: roomCountByProperty.get(propertyKey) || 0,
        // "Room Status" — the room's own state, blank when there is no room
        // record to read it from.
        roomStatus: ci.roomId ? roomStatusById.get(String(ci.roomId)) || "" : "",

        // Client block.
        room: ci.room || "",
        tenant: ci.tenant,
        genderNationality: genderAndNationality(ci),
        gender: ci.gender || "",
        nationality: ci.nationality || "",
        // The sheet's second "Room Status" column, which is really the room
        // type ("Double Room", "GA Double Room").
        roomType: ci.roomType || "",
        phone: ci.phone || "",
        email: ci.email || "",

        // Period of contract.
        contractStart: ci.contractStart || null,
        contractEnd: ci.contractEnd || null,
        duration: contractDuration(ci.contractStart, ci.contractEnd),
        // Flagged rather than filtered by default: a contract running out is
        // the thing this sheet is scanned for.
        expiringSoon: Boolean(end && end >= now && end <= horizon),
        expired: Boolean(end && end < now),

        // Money.
        rent: ci.rent || 0,
        deposit: ci.deposit || 0,
        paymentDueDay: ci.paymentDueDay ?? null,
        bank: ci.bank || "",
        agent: ci.agent || "",

        checkInDate: ci.checkInDate || null,
        status: ci.status,
        hasReferences: hasReferences.has(String(ci._id)),
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

    return res.status(200).json({
      success: true,
      total: rows.length,
      properties: properties.map((p) => ({ _id: String(p._id), name: p.name })),
      // Filter options drawn from every check-in, not just the visible rows, so
      // picking an agent cannot empty the dropdown you picked them from.
      agents: (await CheckIn.distinct("agent", { organizationId, isDeleted: false }))
        .filter(Boolean)
        .sort(),
      banks: (await CheckIn.distinct("bank", { organizationId, isDeleted: false }))
        .filter(Boolean)
        .sort(),
      summary: {
        clients: rows.length,
        properties: new Set(rows.map((r) => r.propertyId + "|" + r.property)).size,
        rent: sum("rent"),
        deposit: sum("deposit"),
        expiringSoon: rows.filter((r) => r.expiringSoon).length,
        expired: rows.filter((r) => r.expired).length,
        missingReferences: rows.filter((r) => !r.hasReferences).length,
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
