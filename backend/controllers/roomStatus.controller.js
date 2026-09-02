// controllers/roomStatus.controller.js
//
// The room status list — "Database Template .xlsx" in the app: every property,
// its rooms, the state each room is in and who is in it.
//
// Like the deposit register this owns no collection. The room and its status
// come from Room; the occupant, their contract dates, contact details, rent,
// deposit, bank and agent come from the ACTIVE check-in against that room.
// Duplicating any of that here would give the same fact two homes.

import Property from "../models/Property.js";
import Room from "../models/Room.js";
import CheckIn from "../models/CheckIn.js";
import { contractDuration, genderAndNationality } from "../utils/duration.js";

// Room.status values, in the order the sheet reads best: what is let, what is
// nearly free, what is free, what cannot be let.
export const ROOM_STATUSES = [
  "OCCUPIED",
  "RESERVED",
  "AVAILABLE_SOON",
  "AVAILABLE",
  "MAINTENANCE",
];

/** Flatten one ACTIVE check-in into the occupant columns of the sheet. */
const occupantFrom = (checkIn) => ({
  checkInId: String(checkIn._id),
  tenant: checkIn.tenant,
  email: checkIn.email || "",
  phone: checkIn.phone || "",
  gender: checkIn.gender || "",
  nationality: checkIn.nationality || "",
  genderNationality: genderAndNationality(checkIn),
  roomType: checkIn.roomType || "",
  rent: checkIn.rent || 0,
  deposit: checkIn.deposit || 0,
  paymentDueDay: checkIn.paymentDueDay ?? null,
  bank: checkIn.bank || "",
  agent: checkIn.agent || "",
  checkInDate: checkIn.checkInDate || null,
  contractStart: checkIn.contractStart || null,
  contractEnd: checkIn.contractEnd || null,
  duration: contractDuration(checkIn.contractStart, checkIn.contractEnd),
});

// @desc    Room status list, grouped by property
// @route   GET /api/v1/room-status
export const getRoomStatusList = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { propertyId, status, search } = req.query;

    const propertyFilter = { organizationId, isDeleted: false };
    if (propertyId) propertyFilter._id = propertyId;

    const roomFilter = { organizationId };
    if (propertyId) roomFilter.propertyId = propertyId;

    const [properties, rooms, checkIns] = await Promise.all([
      Property.find(propertyFilter)
        .select("name address rentalType status")
        .sort({ name: 1 })
        .lean(),
      Room.find(roomFilter)
        .select("propertyId roomName roomNumber title roomType occupancy status monthlyRent rentPeriod securityDeposit availableFrom")
        .sort({ roomName: 1 })
        .lean(),
      // Only current occupants. A checked-out tenant belongs to the check-out
      // register, not to a list of who is in the building today.
      CheckIn.find({ organizationId, isDeleted: false, status: "ACTIVE" })
        .select("propertyId roomId property room tenant email phone gender nationality roomType rent deposit paymentDueDay bank agent checkInDate contractStart contractEnd")
        .lean(),
    ]);

    // Occupants indexed by room, so each room is one map lookup. A room can
    // hold more than one person (the sheet's "DOUBLE"/"FAMILY" occupancy), so
    // the value is a list.
    const byRoom = new Map();
    // Occupants with no roomId — rows typed straight off the spreadsheet, which
    // names a property but no room record. They still have to appear somewhere,
    // so they hang off their property.
    const unlinkedByProperty = new Map();
    // …and occupants whose property is a name with no record behind it either.
    const orphans = [];

    for (const ci of checkIns) {
      if (ci.roomId) {
        const key = String(ci.roomId);
        if (!byRoom.has(key)) byRoom.set(key, []);
        byRoom.get(key).push(ci);
      } else if (ci.propertyId) {
        const key = String(ci.propertyId);
        if (!unlinkedByProperty.has(key)) unlinkedByProperty.set(key, []);
        unlinkedByProperty.get(key).push(ci);
      } else {
        orphans.push(ci);
      }
    }

    const roomsByProperty = new Map();
    for (const room of rooms) {
      const key = String(room.propertyId);
      if (!roomsByProperty.has(key)) roomsByProperty.set(key, []);
      roomsByProperty.get(key).push(room);
    }

    const needle = (search || "").toLowerCase();

    const matches = (row, propertyName) => {
      if (!needle) return true;
      const haystack = [propertyName, row.room, row.roomNumber, row.roomType]
        .concat(row.occupants.map((o) => o.tenant))
        .concat(row.occupants.map((o) => o.email))
        .concat(row.occupants.map((o) => o.phone));
      return haystack.filter(Boolean).some((f) => String(f).toLowerCase().includes(needle));
    };

    const groups = properties.map((property) => {
      const key = String(property._id);

      const roomRows = (roomsByProperty.get(key) || []).map((room) => {
        const occupants = (byRoom.get(String(room._id)) || []).map(occupantFrom);
        return {
          roomId: String(room._id),
          room: room.roomName || room.title || "",
          roomNumber: room.roomNumber || "",
          // The room's own type, from the Room record. The occupant's
          // roomType is what the sheet called it and can differ; both are
          // returned so the screen can show the sheet's wording when there is
          // one and fall back to the record's.
          roomType: room.roomType || "",
          occupancy: room.occupancy || "",
          status: room.status || "AVAILABLE",
          monthlyRent: room.monthlyRent || 0,
          rentPeriod: room.rentPeriod || "MONTHLY",
          securityDeposit: room.securityDeposit || 0,
          availableFrom: room.availableFrom || null,
          linked: true,
          occupants,
        };
      });

      // Spreadsheet occupants with no room record, shown after the real rooms.
      for (const ci of unlinkedByProperty.get(key) || []) {
        roomRows.push({
          roomId: "",
          room: ci.room || "—",
          roomNumber: "",
          roomType: ci.roomType || "",
          occupancy: "",
          // No Room record means no Room.status to read. The room plainly has
          // somebody in it, which is the honest answer here.
          status: "OCCUPIED",
          monthlyRent: ci.rent || 0,
          rentPeriod: "MONTHLY",
          securityDeposit: ci.deposit || 0,
          availableFrom: null,
          // Flags the row as having no Room record behind it, so the screen can
          // offer to create one rather than silently presenting it as managed.
          linked: false,
          occupants: [occupantFrom(ci)],
        });
      }

      const filtered = roomRows
        .filter((r) => (status ? r.status === status : true))
        .filter((r) => matches(r, property.name));

      const counts = ROOM_STATUSES.reduce((acc, s) => {
        acc[s] = roomRows.filter((r) => r.status === s).length;
        return acc;
      }, {});

      return {
        propertyId: key,
        property: property.name,
        postcode: property.address?.postcode || "",
        city: property.address?.city || "",
        rentalType: property.rentalType || "",
        // The sheet's "No of Rooms" — every room on the property, not just the
        // ones surviving the filter, which is what the operator counts beds by.
        roomCount: roomRows.length,
        occupantCount: roomRows.reduce((sum, r) => sum + r.occupants.length, 0),
        rentRoll: roomRows.reduce(
          (sum, r) => sum + r.occupants.reduce((s, o) => s + (o.rent || 0), 0),
          0
        ),
        counts,
        rooms: filtered,
      };
    });

    // A property with no room left after filtering is dropped, so the list
    // answers the filter rather than showing empty headings.
    const visible = groups.filter((g) => g.rooms.length > 0);

    const totals = ROOM_STATUSES.reduce((acc, s) => {
      acc[s] = groups.reduce((sum, g) => sum + (g.counts[s] || 0), 0);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      statuses: ROOM_STATUSES,
      properties: properties.map((p) => ({ _id: String(p._id), name: p.name })),
      summary: {
        properties: groups.length,
        rooms: groups.reduce((sum, g) => sum + g.roomCount, 0),
        occupants: groups.reduce((sum, g) => sum + g.occupantCount, 0),
        rentRoll: groups.reduce((sum, g) => sum + g.rentRoll, 0),
        byStatus: totals,
        // Occupants the list could not place under any property. Surfaced as a
        // number rather than hidden, so a bad import is visible.
        unplaced: orphans.length,
      },
      data: visible,
    });
  } catch (error) {
    console.error("Get Room Status List Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build the room status list." });
  }
};
