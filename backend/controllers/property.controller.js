// controllers/propertyController.js
import Property from "../models/Property.js";
import Room from "../models/Room.js";

/**
 * Generate Property Code
 * Example: PROP-000001
 *
 * Derives the next number from the HIGHEST existing code, not the document
 * count — otherwise deleting a property makes count+1 collide with a code that
 * still exists (propertyCode is unique), throwing a duplicate-key error.
 */
const generatePropertyCode = async () => {
  const last = await Property.findOne({ propertyCode: /^PROP-\d+$/ })
    .sort({ propertyCode: -1 })
    .select("propertyCode")
    .lean();

  const lastNum = last ? parseInt(last.propertyCode.slice(5), 10) || 0 : 0;
  return `PROP-${String(lastNum + 1).padStart(6, "0")}`;
};

/**
 * Create Property
 */
export const createProperty = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    // Get all fields from req.body
    const propertyData = req.body;

    // Validate required fields
    if (!propertyData.name) {
      return res.status(400).json({
        success: false,
        message: "Property name is required.",
      });
    }

    // Check for existing property
    const existing = await Property.findOne({
      organizationId,
      name: propertyData.name,
      isDeleted: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Property already exists.",
      });
    }

    // Create with a retry loop: if two properties race and generate the same
    // propertyCode, regenerate and try again a few times before giving up.
    // propertyCode is set AFTER the spread so a client-supplied value can't
    // override (or collide with) the generated one.
    let property;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        property = await Property.create({
          organizationId,
          createdBy,
          ...propertyData, // all fields from req.body
          propertyCode: await generatePropertyCode(),
        });
        break;
      } catch (err) {
        const isCodeDup =
          err.code === 11000 && err.keyPattern && err.keyPattern.propertyCode;
        if (isCodeDup && attempt < 4) continue; // collided — retry
        throw err;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Property created successfully.",
      data: property,
    });
  } catch (error) {
    console.error(error);

    // Duplicate unique key (e.g. propertyCode, or a unique name index)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `Duplicate value for ${Object.keys(error.keyValue || {}).join(", ")}.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create property.",
    });
  }
};

/**
 * Get Properties with Filters and Pagination
 */
export const getProperties = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      page = 1,
      limit = 10,
      search = "",
      rentalType,
      tenantType,
      status,
    } = req.query;

    const filter = {
      organizationId,
      isDeleted: false,
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { propertyCode: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
        { "address.postcode": { $regex: search, $options: "i" } },
      ];
    }

    if (rentalType) filter.rentalType = rentalType;
    if (tenantType) filter.tenantType = tenantType;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Attach Room Statistics
    const data = await Promise.all(
      properties.map(async (property) => {
        const [totalRooms, occupiedRooms, availableRooms, availableSoonRooms] = await Promise.all([
          Room.countDocuments({ propertyId: property._id }),
          Room.countDocuments({ propertyId: property._id, status: "OCCUPIED" }),
          Room.countDocuments({ propertyId: property._id, status: "AVAILABLE" }),
          Room.countDocuments({ propertyId: property._id, status: "AVAILABLE_SOON" }),
        ]);

        return {
          ...property,
          roomStats: {
            total: totalRooms,
            occupied: occupiedRooms,
            available: availableRooms,
            availableSoon: availableSoonRooms,
          },
        };
      })
    );

    const total = await Property.countDocuments(filter);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties.",
    });
  }
};

/**
 * Get Single Property by ID
 */
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const property = await Property.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    }).lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    // Get room statistics
    const [totalRooms, occupiedRooms, availableRooms, availableSoonRooms] = await Promise.all([
      Room.countDocuments({ propertyId: property._id }),
      Room.countDocuments({ propertyId: property._id, status: "OCCUPIED" }),
      Room.countDocuments({ propertyId: property._id, status: "AVAILABLE" }),
      Room.countDocuments({ propertyId: property._id, status: "AVAILABLE_SOON" }),
    ]);

    // Get all rooms for this property
    const rooms = await Room.find({
      propertyId: property._id,
    })
      .select("title roomName roomNumber status monthlyRent roomType occupancy")
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...property,
        roomStats: {
          total: totalRooms,
          occupied: occupiedRooms,
          available: availableRooms,
          availableSoon: availableSoonRooms,
        },
        rooms,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch property.",
    });
  }
};

/**
 * Update Property
 */
export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const {
      name,
      rentalType,
      tenantType,
      ownerName,
      address,
      location,
      description,
      coverImage,
      gallery,
      status,
    } = req.body;

    const property = await Property.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    // Check for duplicate name
    if (name && name !== property.name) {
      const existing = await Property.findOne({
        organizationId,
        name,
        isDeleted: false,
        _id: { $ne: id },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Property with this name already exists.",
        });
      }
    }

    // Update fields
    if (name) property.name = name;
    if (rentalType) property.rentalType = rentalType;
    if (tenantType) property.tenantType = tenantType;
    if (ownerName !== undefined) property.ownerName = ownerName;
    if (address) property.address = address;
    if (location) property.location = location;
    if (description !== undefined) property.description = description;
    if (coverImage !== undefined) property.coverImage = coverImage;
    if (gallery) property.gallery = gallery;
    if (status) property.status = status;

    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property updated successfully.",
      data: property,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property.",
    });
  }
};

/**
 * Soft Delete Property
 */
export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const property = await Property.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    // Check if property has occupied rooms
    const occupiedRooms = await Room.countDocuments({
      propertyId: id,
      status: "OCCUPIED",
    });

    if (occupiedRooms > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete property with occupied rooms.",
      });
    }

    // Soft delete
    property.isDeleted = true;
    property.deletedAt = new Date();
    property.status = "ARCHIVED";
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete property.",
    });
  }
};

/**
 * Restore Archived Property
 */
export const restoreProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const property = await Property.findOne({
      _id: id,
      organizationId,
      isDeleted: true,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Archived property not found.",
      });
    }

    property.isDeleted = false;
    property.deletedAt = null;
    property.status = "ACTIVE";
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property restored successfully.",
      data: property,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore property.",
    });
  }
};

/**
 * Update Property Status
 */
export const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user.organizationId;

    if (!status || !["ACTIVE", "ARCHIVED", "DRAFT"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be ACTIVE, ARCHIVED, or DRAFT.",
      });
    }

    const property = await Property.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    property.status = status;
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property status updated successfully.",
      data: property,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update property status.",
    });
  }
};

/**
 * Get Property Statistics (Dashboard)
 */
export const getPropertyStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const [totalProperties, activeProperties, archivedProperties, draftProperties] = await Promise.all([
      Property.countDocuments({ organizationId, isDeleted: false }),
      Property.countDocuments({ organizationId, isDeleted: false, status: "ACTIVE" }),
      Property.countDocuments({ organizationId, isDeleted: false, status: "ARCHIVED" }),
      Property.countDocuments({ organizationId, isDeleted: false, status: "DRAFT" }),
    ]);

    // Get total rooms across all properties
    const properties = await Property.find({
      organizationId,
      isDeleted: false,
    }).select("_id");

    const propertyIds = properties.map(p => p._id);
    
    const [totalRooms, occupiedRooms, availableRooms] = await Promise.all([
      Room.countDocuments({ propertyId: { $in: propertyIds } }),
      Room.countDocuments({ propertyId: { $in: propertyIds }, status: "OCCUPIED" }),
      Room.countDocuments({ propertyId: { $in: propertyIds }, status: "AVAILABLE" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        properties: {
          total: totalProperties,
          active: activeProperties,
          archived: archivedProperties,
          draft: draftProperties,
        },
        rooms: {
          total: totalRooms,
          occupied: occupiedRooms,
          available: availableRooms,
          occupancyRate: totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(2) : 0,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch property statistics.",
    });
  }
};