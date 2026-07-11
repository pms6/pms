// controllers/inspectionController.js
import Inspection from "../models/Inspection.js";

// =============================================
// CREATE NEW INSPECTION
// =============================================
export const createInspection = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const { date, ...restData } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Inspection date is required",
      });
    }

    const inspectionDate = new Date(date);

    const inspectionData = {
      ...restData,
      organizationId: orgId,
      date: inspectionDate,
      createdBy: req.user._id,
      reminderDate: new Date(inspectionDate.getTime() - 30 * 24 * 60 * 60 * 1000),
    };

    const inspection = await Inspection.create(inspectionData);

    await inspection.populate([
      { path: "propertyId", select: "name propertyCode" },
      { path: "roomId", select: "roomName roomNumber" },
      { path: "inspector", select: "name email" },
    ]);

    res.status(201).json({
      success: true,
      message: "Inspection created successfully",
      data: inspection,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// =============================================
// GET ALL INSPECTIONS FOR SPECIFIC ORGANIZATION
// =============================================
export const getInspections = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const {
      status,
      type,
      propertyId,
      roomId,
      upcoming,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const query = { 
      organizationId: orgId, 
      isDeleted: false 
    };

    // Filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (propertyId) query.propertyId = propertyId;
    if (roomId) query.roomId = roomId;

    if (upcoming === "true") {
      query.date = { $gte: new Date() };
    }

    if (startDate || endDate) {
      query.date = query.date || {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * Number(limit);

    const inspections = await Inspection.find(query)
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomName roomNumber title")
      .populate("inspector", "name email")
      .sort({ date: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Inspection.countDocuments(query);

    res.status(200).json({
      success: true,
      count: inspections.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      data: inspections,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// =============================================
// GET SINGLE INSPECTION
// =============================================
export const getInspection = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const inspection = await Inspection.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    })
      .populate("propertyId", "name propertyCode address")
      .populate("roomId", "roomName roomNumber title")
      .populate("inspector", "name email");

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: "Inspection not found",
      });
    }

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// =============================================
// UPDATE INSPECTION
// =============================================
export const updateInspection = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const { date, ...restData } = req.body;
    const updateData = { ...restData };

    if (date) {
      const inspectionDate = new Date(date);
      updateData.date = inspectionDate;
      updateData.reminderDate = new Date(
        inspectionDate.getTime() - 30 * 24 * 60 * 60 * 1000
      );
    }

    const inspection = await Inspection.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: "propertyId", select: "name propertyCode" },
      { path: "roomId", select: "roomName roomNumber" },
      { path: "inspector", select: "name email" },
    ]);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: "Inspection not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inspection updated successfully",
      data: inspection,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

// =============================================
// DELETE & COMPLETE (Same pattern)
// =============================================
export const deleteInspection = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const inspection = await Inspection.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: "Inspection not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inspection deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// controllers/inspectionController.js
export const completeInspection = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({
        success: false,
        error: "Organization ID not found",
      });
    }

    const { findings, notes } = req.body || {}; // Safe destructuring

    const inspection = await Inspection.findOneAndUpdate(
      { 
        _id: id, 
        organizationId: orgId, 
        isDeleted: false 
      },
      {
        status: "COMPLETED",
        findings: findings || [],        // Default to empty array
        notes: notes || "",              // Default to empty string
      },
      { new: true }
    ).populate([
      { path: "propertyId", select: "name" },
      { path: "roomId", select: "roomName" },
      { path: "inspector", select: "name" },
    ]);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: "Inspection not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Inspection marked as completed",
      data: inspection,
    });
  } catch (error) {
    console.error("Complete Inspection Error:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};