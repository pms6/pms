import Viewing from "../models/Viewing.js";
import Lead from "../models/Lead.js";
import Room from "../models/Room.js";

// @desc    Get the signed-in TENANT's own viewings (matched by their leads).
// @route   GET /api/viewings/my
//
// A viewing belongs to a Lead; the tenant is identified by the lead's email
// (what website enquiries are keyed on), so we resolve their leads first, then
// the viewings booked against them — across every organisation they enquired to.
export const getMyViewings = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.json({ success: true, data: [] });

    const leads = await Lead.find({ email, isDeleted: false }).select("_id").lean();
    const leadIds = leads.map((l) => l._id);
    if (leadIds.length === 0) return res.json({ success: true, data: [] });

    const viewings = await Viewing.find({ lead: { $in: leadIds }, isDeleted: false })
      .populate("property", "name")
      .populate("room", "roomName roomNumber title")
      .populate("organizationId", "name phone")
      .sort({ date: -1, time: -1 });

    res.json({ success: true, data: viewings });
  } catch (error) {
    console.error("Get My Viewings Error:", error);
    res.status(500).json({ success: false, message: "Failed to load your viewings." });
  }
};

// @desc    Tenant cancels one of their OWN scheduled viewings.
// @route   PATCH /api/viewings/my/:id/cancel
export const cancelMyViewing = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(404).json({ success: false, message: "Viewing not found." });

    const leads = await Lead.find({ email, isDeleted: false }).select("_id").lean();
    const leadIds = leads.map((l) => l._id);

    const viewing = await Viewing.findOne({
      _id: req.params.id,
      lead: { $in: leadIds },
      isDeleted: false,
    });

    if (!viewing) {
      return res.status(404).json({ success: false, message: "Viewing not found." });
    }
    if (viewing.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: "Only scheduled viewings can be cancelled.",
      });
    }

    viewing.status = "cancelled";
    await viewing.save();

    const populated = await viewing.populate([
      { path: "property", select: "name" },
      { path: "room", select: "roomName roomNumber title" },
      { path: "organizationId", select: "name phone" },
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error("Cancel My Viewing Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all viewings (with optional filters)
// @route   GET /api/viewings
export const getViewings = async (req, res) => {
  try {

    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ message: "Organization ID required" });
    }

    const { status } = req.query;

    const query = { 
      organizationId: orgId, 
      isDeleted: false 
    };

    if (status) query.status = status;

    const viewings = await Viewing.find(query)
      .populate("lead", "name email phone")
      .populate("property", "name")
      .populate("room", "roomName roomNumber title")
      .sort({ date: 1, time: 1 });

    res.json(viewings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new viewing
// @route   POST /api/viewings
// @desc    Create new viewing
// @route   POST /api/viewings
export const createViewing = async (req, res) => {
  try {
    const orgIdFromMiddleware = req.user.organizationId;
    const userIdFromMiddleware = req.user._id;

    // Priority: Use from middleware, fallback to payload
    const organizationId = orgIdFromMiddleware || req.body.organizationId;
    const createdBy = userIdFromMiddleware || req.body.createdBy;

    if (!organizationId) {
      return res.status(400).json({ 
        message: "organizationId is required" 
      });
    }

    const viewing = new Viewing({
      ...req.body,
      organizationId: organizationId,
      createdBy: createdBy,        // optional
    });

    const savedViewing = await viewing.save();

    const populated = await savedViewing.populate([
      { path: "lead", select: "name email phone" },
      { path: "property", select: "name" },
      { path: "room", select: "roomName roomNumber title" },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    console.error("Create Viewing Error:", error);
    res.status(400).json({ 
      message: error.message,
      details: error.errors 
    });
  }
};

// @desc    Update viewing
// @route   PUT /api/viewings/:id
export const updateViewing = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const viewing = await Viewing.findOne({
      _id: req.params.id,
      organizationId: orgId,
      isDeleted: false,
    });

    if (!viewing) {
      return res.status(404).json({ message: "Viewing not found" });
    }

    Object.assign(viewing, req.body);
    const updated = await viewing.save();

    const populated = await updated.populate([
      { path: "lead", select: "name email phone" },
      { path: "property", select: "name" },
      { path: "room", select: "roomName roomNumber" },
    ]);

    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete viewing (soft delete)
// @route   DELETE /api/viewings/:id
export const deleteViewing = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const viewing = await Viewing.findOne({
      _id: req.params.id,
      organizationId: orgId,
    });

    if (!viewing) {
      return res.status(404).json({ message: "Viewing not found" });
    }

    viewing.isDeleted = true;
    viewing.deletedAt = new Date();
    await viewing.save();

    res.json({ message: "Viewing deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:mm, 24h

const POPULATE = [
  { path: "lead", select: "name email phone" },
  { path: "property", select: "name" },
  { path: "room", select: "roomName roomNumber title" },
];

// Moves a viewing to a new slot and records where it came from. Used by both
// the operator's direct reschedule and the approval of a tenant's request, so
// the trail looks the same either way.
const moveSlot = (viewing, { date, time, reason, userId }) => {
  viewing.rescheduleHistory.push({
    fromDate: viewing.date,
    fromTime: viewing.time,
    toDate: date,
    toTime: time,
    reason: String(reason ?? "").trim(),
    rescheduledBy: userId || null,
    at: new Date(),
  });

  viewing.date = date;
  viewing.time = time;
  viewing.lastRescheduledAt = new Date();
};

// @desc    Move a scheduled viewing to a new date/time, keeping the trail.
// @route   PATCH /api/viewings/:id/reschedule
export const rescheduleViewing = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { date, time, reason } = req.body;

    if (!DATE_RE.test(String(date || ""))) {
      return res.status(400).json({ message: "A valid date (YYYY-MM-DD) is required." });
    }
    if (!TIME_RE.test(String(time || ""))) {
      return res.status(400).json({ message: "A valid time (HH:mm) is required." });
    }

    const viewing = await Viewing.findOne({
      _id: req.params.id,
      organizationId: orgId,
      isDeleted: false,
    });

    if (!viewing) {
      return res.status(404).json({ message: "Viewing not found" });
    }

    // A viewing that already happened or was called off is history — reopening
    // it by moving it would quietly resurrect a closed record.
    if (viewing.status !== "scheduled") {
      return res.status(400).json({
        message: `Only scheduled viewings can be rescheduled — this one is ${viewing.status}.`,
      });
    }

    if (viewing.date === date && viewing.time === time) {
      return res.status(400).json({ message: "That is already the scheduled slot." });
    }

    moveSlot(viewing, { date, time, reason, userId: req.user._id });

    // An operator moving the slot by hand settles any request the tenant had
    // outstanding — leaving it "pending" would ask them to decide twice.
    if (viewing.rescheduleRequest?.status === "pending") {
      viewing.rescheduleRequest.status = "approved";
      viewing.rescheduleRequest.respondedBy = req.user._id;
      viewing.rescheduleRequest.respondedAt = new Date();
    }

    await viewing.save();

    const populated = await viewing.populate(POPULATE);

    res.json(populated);
  } catch (error) {
    console.error("Reschedule Viewing Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Tenant proposes a new slot for one of their OWN viewings.
// @route   PATCH /api/viewings/my/:id/reschedule-request
//
// The tenant never moves the calendar themselves — this records a proposal an
// operator then approves or declines.
export const requestMyViewingReschedule = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(404).json({ success: false, message: "Viewing not found." });

    const { date, time, reason } = req.body;

    if (!DATE_RE.test(String(date || ""))) {
      return res
        .status(400)
        .json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }
    if (!TIME_RE.test(String(time || ""))) {
      return res
        .status(400)
        .json({ success: false, message: "A valid time (HH:mm) is required." });
    }

    const leads = await Lead.find({ email, isDeleted: false }).select("_id").lean();
    const leadIds = leads.map((l) => l._id);

    const viewing = await Viewing.findOne({
      _id: req.params.id,
      lead: { $in: leadIds },
      isDeleted: false,
    });

    if (!viewing) {
      return res.status(404).json({ success: false, message: "Viewing not found." });
    }
    if (viewing.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: `Only scheduled viewings can be rescheduled — this one is ${viewing.status}.`,
      });
    }
    if (viewing.date === date && viewing.time === time) {
      return res
        .status(400)
        .json({ success: false, message: "That is already your scheduled slot." });
    }

    // A new proposal while one is pending replaces it, so a tenant who changes
    // their mind isn't stuck waiting on a slot they no longer want.
    viewing.rescheduleRequest = {
      status: "pending",
      requestedDate: date,
      requestedTime: time,
      reason: String(reason ?? "").trim(),
      requestedBy: req.user._id,
      requestedAt: new Date(),
      respondedBy: null,
      respondedAt: null,
      responseNote: "",
    };

    await viewing.save();

    const populated = await viewing.populate([
      { path: "property", select: "name" },
      { path: "room", select: "roomName roomNumber title" },
      { path: "organizationId", select: "name phone" },
    ]);

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error("Request Reschedule Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Operator approves or declines a tenant's reschedule request.
// @route   PATCH /api/viewings/:id/reschedule-request/respond
export const respondToRescheduleRequest = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { action, note } = req.body;

    if (!["approve", "decline"].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "decline".' });
    }

    const viewing = await Viewing.findOne({
      _id: req.params.id,
      organizationId: orgId,
      isDeleted: false,
    });

    if (!viewing) {
      return res.status(404).json({ message: "Viewing not found" });
    }
    if (viewing.rescheduleRequest?.status !== "pending") {
      return res.status(400).json({ message: "There is no pending reschedule request." });
    }

    const { requestedDate, requestedTime, reason } = viewing.rescheduleRequest;

    if (action === "approve") {
      // Guard the stored slot too — the request was validated when it was made,
      // but this is what actually writes to the calendar.
      if (!DATE_RE.test(requestedDate || "") || !TIME_RE.test(requestedTime || "")) {
        return res.status(400).json({ message: "The requested slot is not a valid date/time." });
      }

      moveSlot(viewing, {
        date: requestedDate,
        time: requestedTime,
        reason: reason ? `Tenant request: ${reason}` : "Tenant request",
        userId: req.user._id,
      });
    }

    viewing.rescheduleRequest.status = action === "approve" ? "approved" : "declined";
    viewing.rescheduleRequest.respondedBy = req.user._id;
    viewing.rescheduleRequest.respondedAt = new Date();
    viewing.rescheduleRequest.responseNote = String(note ?? "").trim();

    await viewing.save();

    const populated = await viewing.populate(POPULATE);

    res.json(populated);
  } catch (error) {
    console.error("Respond To Reschedule Request Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mark viewing as done / cancelled
// @route   PATCH /api/viewings/:id/status
export const updateViewingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orgId = req.user.organizationId;

    if (!["done", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const viewing = await Viewing.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId, isDeleted: false },
      { status },
      { new: true }
    ).populate([
      { path: "lead", select: "name email phone" },
      { path: "property", select: "name" },
      { path: "room", select: "roomName roomNumber" },
    ]);

    if (!viewing) {
      return res.status(404).json({ message: "Viewing not found" });
    }

    res.json(viewing);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};