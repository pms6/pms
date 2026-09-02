// controllers/depositRegister.controller.js
//
// The deposit register — one line per deposit, from the day it was taken at
// check-in to the day it was settled at check-out.
//
// It owns no collection of its own. A deposit is not an event, it is the span
// between two events the app already records: CheckIn.deposit is the money in,
// CheckOut.advanceLicenceFee / depositReturned / depositDeducted is the money
// out. Storing it a third time would give three places for the same figure to
// disagree, so this reads across the pair instead.
//
// Both spreadsheets call the same figure by different names — "Deposit" on the
// check-in sheet, "Advance liscene Fee" on the check-out sheet — which is
// precisely why they need reconciling on one screen.

import CheckIn from "../models/CheckIn.js";
import CheckOut, { DEPOSIT_STATUS } from "../models/CheckOut.js";

// A deposit that has been taken and not yet settled. Not a CheckOut
// depositStatus, because no check-out exists for it yet — that is the point.
const HELD = "HELD";

export const REGISTER_STATUS = [HELD, ...DEPOSIT_STATUS];

const toId = (value) => (value ? String(value) : "");

/**
 * Build one register line from a check-in and the check-out that settled it
 * (if any).
 */
const lineFromCheckIn = (checkIn, checkOut) => {
  const taken = checkIn.deposit || 0;
  const returned = checkOut?.depositReturned || 0;
  const deducted = checkOut?.depositDeducted || 0;

  return {
    _id: toId(checkIn._id),
    source: "CHECK_IN",
    checkInId: toId(checkIn._id),
    checkOutId: toId(checkOut?._id),

    property: checkIn.property,
    room: checkIn.room,
    tenant: checkIn.tenant,
    propertyId: toId(checkIn.propertyId),

    // Money in
    taken,
    bank: checkIn.bank || "",
    agent: checkIn.agent || "",
    takenOn: checkIn.checkInDate || null,
    rent: checkIn.rent || 0,

    // Money out — null until a check-out settles it
    status: checkOut ? checkOut.depositStatus : HELD,
    settledOn: checkOut?.actualMovedOutDate || checkOut?.movedOutDate || null,
    returned,
    deducted,
    note: checkOut?.depositNote || "",

    // What is still on the books for this tenant. A held deposit is fully
    // outstanding; a settled one is whatever the check-out did not account for.
    outstanding: checkOut ? Math.max(taken - returned - deducted, 0) : taken,
  };
};

/**
 * Build a register line from a check-out that names no check-in. Historic
 * spreadsheet rows look like this: the tenant moved out before the app existed,
 * so there is nothing on the money-in side but the settlement still counts.
 */
const lineFromOrphanCheckOut = (checkOut) => {
  const taken = checkOut.advanceLicenceFee || 0;
  const returned = checkOut.depositReturned || 0;
  const deducted = checkOut.depositDeducted || 0;

  return {
    _id: toId(checkOut._id),
    source: "CHECK_OUT",
    checkInId: "",
    checkOutId: toId(checkOut._id),

    property: checkOut.property,
    room: checkOut.room,
    tenant: checkOut.tenant,
    propertyId: toId(checkOut.propertyId),

    taken,
    bank: "",
    agent: "",
    takenOn: null,
    rent: checkOut.rent || 0,

    status: checkOut.depositStatus,
    settledOn: checkOut.actualMovedOutDate || checkOut.movedOutDate || null,
    returned,
    deducted,
    note: checkOut.depositNote || "",

    outstanding: Math.max(taken - returned - deducted, 0),
  };
};

// @desc    The deposit register — every deposit taken, and how it was settled
// @route   GET /api/v1/deposit-register
export const getDepositRegister = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { propertyId, status, bank, agent, search } = req.query;

    const checkInFilter = { organizationId, isDeleted: false };
    if (propertyId) checkInFilter.propertyId = propertyId;
    if (bank) checkInFilter.bank = bank;
    if (agent) checkInFilter.agent = agent;

    const checkOutFilter = { organizationId, isDeleted: false };
    if (propertyId) checkOutFilter.propertyId = propertyId;

    const [checkIns, checkOuts] = await Promise.all([
      CheckIn.find(checkInFilter)
        .select(
          "property room tenant propertyId deposit rent bank agent checkInDate status"
        )
        .lean(),
      CheckOut.find(checkOutFilter)
        .select(
          "property room tenant propertyId checkInId advanceLicenceFee rent depositStatus depositReturned depositDeducted depositNote movedOutDate actualMovedOutDate"
        )
        .lean(),
    ]);

    // Index the check-outs by the check-in they settle, so pairing is one pass
    // rather than a scan of the check-out list per check-in.
    const settledBy = new Map();
    for (const co of checkOuts) {
      if (co.checkInId) settledBy.set(String(co.checkInId), co);
    }

    const lines = checkIns.map((ci) => lineFromCheckIn(ci, settledBy.get(String(ci._id))));

    // Check-outs that settle nothing this register already knows about. When a
    // property filter is on, a check-out whose check-in was filtered out would
    // otherwise reappear here as an orphan, so match on the check-in list we
    // actually loaded rather than on checkInId being absent.
    const knownCheckIns = new Set(checkIns.map((ci) => String(ci._id)));
    for (const co of checkOuts) {
      if (co.checkInId && knownCheckIns.has(String(co.checkInId))) continue;
      if (co.checkInId && propertyId) continue;
      lines.push(lineFromOrphanCheckOut(co));
    }

    // Filters that can only be applied once the two sides are joined.
    let rows = lines;
    if (status) rows = rows.filter((r) => r.status === status);
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.tenant, r.property, r.room, r.note, r.bank, r.agent]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      );
    }

    // Newest activity first: a settled deposit sorts by when it was settled, a
    // held one by when it was taken.
    rows.sort((a, b) => {
      const at = new Date(a.settledOn || a.takenOn || 0).getTime();
      const bt = new Date(b.settledOn || b.takenOn || 0).getTime();
      return bt - at;
    });

    const byStatus = REGISTER_STATUS.reduce((acc, s) => {
      acc[s] = rows.filter((r) => r.status === s).length;
      return acc;
    }, {});

    const sum = (key) => rows.reduce((total, r) => total + (r[key] || 0), 0);

    return res.status(200).json({
      success: true,
      total: rows.length,
      statuses: REGISTER_STATUS,
      byStatus,
      totals: {
        taken: sum("taken"),
        returned: sum("returned"),
        deducted: sum("deducted"),
        // Money the organization is still holding on tenants' behalf — the one
        // figure on this screen that has to reconcile against the bank.
        held: rows.filter((r) => r.status === HELD).reduce((t, r) => t + (r.taken || 0), 0),
        outstanding: sum("outstanding"),
      },
      data: rows,
    });
  } catch (error) {
    console.error("Get Deposit Register Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build the deposit register." });
  }
};
