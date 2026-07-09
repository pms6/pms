import Viewing from "../models/Viewing.js";
import Lead from "../models/Lead.js";
import Room from "../models/Room.js";

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