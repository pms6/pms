// controllers/lead.controller.js
import Lead from "../models/Lead.js";

const LEAD_STAGES = ["new", "qualified", "viewing", "converted", "lost"];

/**
 * Create Lead
 */
export const createLead = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const {
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId,
      roomId,
      budget,
      assignedTo,
      status,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required.",
      });
    }

    const lead = await Lead.create({
      organizationId,
      createdBy,
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId: propertyId || null,
      roomId: roomId || null,
      budget: budget ? Number(budget) : 0,
      assignedTo,
      status: status || "new",
      notes,
      // A lead created straight into "lost" still records why, when given.
      lostReason: status === "lost" ? String(req.body.lostReason ?? "").trim() : "",
      lostAt: status === "lost" ? new Date() : null,
    });

    // Populate references before sending response
    const populatedLead = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber type");

    return res.status(201).json({
      success: true,
      message: "Lead created successfully.",
      data: populatedLead,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create lead.",
    });
  }
};

/**
 * Get Leads (optionally filtered by status / search)
 */
export const getLeads = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status, source, search = "" } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (status) filter.status = status;
    if (source) filter.source = source;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { interestedIn: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(filter)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: leads.length,
      data: leads,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leads.",
    });
  }
};

/**
 * Get Single Lead by ID
 */
export const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    })
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead.",
    });
  }
};

/**
 * Update Lead
 */
export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    const {
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId,
      roomId,
      budget,
      assignedTo,
      status,
      notes,
    } = req.body;

    if (name !== undefined) lead.name = name;
    if (email !== undefined) lead.email = email;
    if (phone !== undefined) lead.phone = phone;
    if (source !== undefined) lead.source = source;
    if (interestedIn !== undefined) lead.interestedIn = interestedIn;
    if (propertyId !== undefined) lead.propertyId = propertyId || null;
    if (roomId !== undefined) lead.roomId = roomId || null;
    if (budget !== undefined) lead.budget = Number(budget) || 0;
    if (assignedTo !== undefined) lead.assignedTo = assignedTo;
    if (notes !== undefined) lead.notes = notes;

    // Keep the lost reason in step with the stage, the same way the Kanban
    // status endpoint does.
    if (status !== undefined) {
      lead.status = status;

      if (status === "lost") {
        const reason = String(req.body.lostReason ?? lead.lostReason ?? "").trim();
        if (!reason) {
          return res.status(400).json({
            success: false,
            message: "A reason is required when marking a lead as lost.",
          });
        }
        lead.lostReason = reason;
        lead.lostAt = lead.lostAt || new Date();
      } else {
        lead.lostReason = "";
        lead.lostAt = null;
      }
    }

    await lead.save();

    // Return populated document
    const updatedLead = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully.",
      data: updatedLead,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update lead.",
    });
  }
};

/**
 * Update Lead Status (drag between Kanban columns)
 */
export const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, lostReason } = req.body;
    const organizationId = req.user.organizationId;

    if (!status || !LEAD_STAGES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${LEAD_STAGES.join(", ")}.`,
      });
    }

    // Losing a lead has to say why. Moving back out of "lost" clears the reason
    // so a live lead never carries a stale one.
    const reason = String(lostReason ?? "").trim();

    if (status === "lost" && !reason) {
      return res.status(400).json({
        success: false,
        message: "A reason is required when marking a lead as lost.",
      });
    }

    const update =
      status === "lost"
        ? { status, lostReason: reason, lostAt: new Date() }
        : { status, lostReason: "", lostAt: null };

    const lead = await Lead.findOneAndUpdate(
      { _id: id, organizationId, isDeleted: false },
      update,
      { new: true }
    )
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lead status updated successfully.",
      data: lead,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update lead status.",
    });
  }
};

/**
 * Delete Lead (soft delete)
 */
export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    lead.isDeleted = true;
    lead.deletedAt = new Date();
    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete lead.",
    });
  }
};

/**
 * Lead Statistics (counts per stage)
 */
export const getLeadStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const counts = await Promise.all(
      LEAD_STAGES.map((stage) =>
        Lead.countDocuments({ organizationId, isDeleted: false, status: stage })
      )
    );

    const byStage = LEAD_STAGES.reduce((acc, stage, i) => {
      acc[stage] = counts[i];
      return acc;
    }, {});

    const total = counts.reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      data: { total, byStage },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead statistics.",
    });
  }
};