// controllers/stayDuration.controller.js
//
// Overall Stay Duration — how long each person has been with us, read across
// BOTH registers in one place.
//
// The client register and the tenancy register are independent by design (see
// the note at the top of models/Client.js): the same person can exist in both,
// with different details, and neither corrects the other. This section does not
// try to merge them. It lists both, says which register each row came from, and
// flags when the same email appears on both sides so the office can see the
// overlap without either register being quietly rewritten.
//
// What it measures is one thing only: today minus the person's FIRST move-in.
// The contract or tenancy they happen to be on is carried alongside it, never
// subtracted from it — a renewal moves those dates and leaves the stay alone.

import Client from "../models/Client.js";
import Tenancy from "../models/Tenancy.js";
import { stayDuration } from "../utils/duration.js";

/** A tenancy's current term end — a periodic tenancy has nothing to count to. */
const tenancyEnd = (t) => t.fixedTermEnd || t.periodicStart || null;

const norm = (email) => String(email || "").trim().toLowerCase();

// @desc    Overall stay duration for every client and tenant
// @route   GET /api/v1/stay-duration
// @query   source=client|tenant · search · propertyId · withDate=1 (only rows
//          that have a first move-in date)
export const getStayDurations = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const now = new Date();
    const { source, search = "", propertyId, withDate } = req.query;

    const wantClients = source !== "tenant";
    const wantTenants = source !== "client";

    const [clients, tenancies] = await Promise.all([
      wantClients
        ? Client.find({ organizationId, isDeleted: false })
            .select("tenant email phone property propertyId room firstMoveInDate contractStart contractEnd status")
            .lean()
        : [],
      wantTenants
        ? // Ended tenancies are kept: an ended tenancy is still time the person
          // spent with us, and is usually what a renewal replaced.
          Tenancy.find({ organizationId })
            .select("tenant tenantEmail property propertyId unit firstMoveInDate startDate fixedTermEnd periodicStart status isDeleted")
            .lean()
        : [],
    ]);

    const clientRows = clients.map((c) => ({
      _id: String(c._id),
      source: "client",
      name: c.tenant || "—",
      email: norm(c.email),
      phone: c.phone || "",
      property: c.property || "",
      propertyId: c.propertyId ? String(c.propertyId) : "",
      unit: c.room || "",
      firstMoveInDate: c.firstMoveInDate || null,
      stay: stayDuration(c.firstMoveInDate, now),
      // The CURRENT agreement, carried alongside the stay and never folded into it.
      currentStart: c.contractStart || null,
      currentEnd: c.contractEnd || null,
      status: c.status || "",
    }));

    // One row per tenancy would list a renewed tenant several times, each with
    // the same stay. The register is read per person here, so only their latest
    // tenancy is shown — the earlier ones are what the first move-in already
    // accounts for.
    const latestByPerson = new Map();
    for (const t of tenancies) {
      const key = norm(t.tenantEmail) || `name:${String(t.tenant || "").toLowerCase()}:${String(t.propertyId || "")}`;
      const seen = latestByPerson.get(key);
      const start = t.startDate ? new Date(t.startDate) : new Date(0);
      if (!seen || start > (seen.startDate ? new Date(seen.startDate) : new Date(0))) {
        latestByPerson.set(key, t);
      }
    }

    const tenantRows = [...latestByPerson.values()].map((t) => ({
      _id: String(t._id),
      source: "tenant",
      name: t.tenant || "—",
      email: norm(t.tenantEmail),
      phone: "",
      property: t.property || "",
      propertyId: t.propertyId ? String(t.propertyId) : "",
      unit: t.unit || "",
      firstMoveInDate: t.firstMoveInDate || null,
      stay: stayDuration(t.firstMoveInDate, now),
      currentStart: t.startDate || null,
      currentEnd: tenancyEnd(t),
      status: t.isDeleted ? "PAST" : t.status || "",
    }));

    // Who appears on both sides. Flagged, never merged — the two registers are
    // maintained by different people and are allowed to disagree.
    const clientEmails = new Set(clientRows.map((r) => r.email).filter(Boolean));
    const tenantEmails = new Set(tenantRows.map((r) => r.email).filter(Boolean));

    let rows = [...clientRows, ...tenantRows].map((r) => ({
      ...r,
      inBothRegisters: Boolean(
        r.email && (r.source === "client" ? tenantEmails.has(r.email) : clientEmails.has(r.email))
      ),
    }));

    if (propertyId) rows = rows.filter((r) => r.propertyId === String(propertyId));
    if (withDate === "1") rows = rows.filter((r) => r.firstMoveInDate);

    if (search) {
      const needle = String(search).toLowerCase();
      rows = rows.filter((r) =>
        [r.name, r.email, r.property, r.unit]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      );
    }

    // Longest stay first — the question this section is opened to answer.
    // Rows with no first move-in date sink to the bottom rather than reading as
    // a stay of zero.
    rows.sort((a, b) => {
      if (!a.stay && !b.stay) return a.name.localeCompare(b.name);
      if (!a.stay) return 1;
      if (!b.stay) return -1;
      return b.stay.days - a.stay.days || a.name.localeCompare(b.name);
    });

    const measured = rows.filter((r) => r.stay);
    const totalDays = measured.reduce((sum, r) => sum + r.stay.days, 0);

    const summary = {
      people: rows.length,
      measured: measured.length,
      // Rows the office still has to put a first move-in date on.
      missingDate: rows.length - measured.length,
      clients: rows.filter((r) => r.source === "client").length,
      tenants: rows.filter((r) => r.source === "tenant").length,
      inBothRegisters: rows.filter((r) => r.inBothRegisters).length,
      totalDays,
      averageDays: measured.length ? Math.round(totalDays / measured.length) : 0,
      longest: measured[0] || null,
      shortest: measured.length ? measured[measured.length - 1] : null,
    };

    return res.status(200).json({ success: true, count: rows.length, summary, data: rows });
  } catch (error) {
    console.error("Stay Duration Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load the stay duration register." });
  }
};
