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