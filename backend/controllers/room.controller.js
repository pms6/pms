// controllers/roomController.js
import Room from "../models/Room.js";
import Property from "../models/Property.js";

/**
 * Generate Room Code
 * Example: RM-000001
 *
 * Derives the next number from the HIGHEST existing code, not the document
 * count — otherwise deleting a room makes count+1 collide with a code that
 * still exists (listingCode is unique), throwing a duplicate-key error.
 */
const generateRoomCode = async () => {
  const last = await Room.findOne({ listingCode: /^RM-\d+$/ })
    .sort({ listingCode: -1 })
    .select("listingCode")
    .lean();

  const lastNum = last ? parseInt(last.listingCode.slice(3), 10) || 0 : 0;
  return `RM-${String(lastNum + 1).padStart(6, "0")}`;
};

/**
 * Create Room
 */
export const createRoom = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const {
      propertyId,
      title,
      roomName,
      roomNumber,
      roomLabel,
      description,
      roomType,
      occupancy,
      furnished,
      floor,
      roomSize,
      bathroomType,
      monthlyRent,
      securityDeposit,
      holdingDeposit,
      billsIncluded,
      status,
      availableImmediately,
      availableFrom,
      minimumTenancy,
      maximumTenancy,
      roomAmenities,
      propertyAmenities,
      wifiSpeed,
      images,
      featured,
      isPublished,
      slug,
      notes,
    } = req.body;

    // Validate required fields
    if (!propertyId || !title || !roomName || !monthlyRent) {
      return res.status(400).json({
        success: false,
        message: "Property ID, title, room name, and monthly rent are required.",
      });
    }

    // Verify property exists and belongs to organization
    const property = await Property.findOne({
      _id: propertyId,
      organizationId,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    // Generate slug if not provided
    const finalSlug = slug || title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if slug already exists
    const existingSlug = await Room.findOne({ slug: finalSlug });
    const uniqueSlug = existingSlug ? `${finalSlug}-${Date.now()}` : finalSlug;

    const basePayload = {
      organizationId,
      propertyId,
      createdBy,
      title,
      roomName,
      roomNumber,
      roomLabel,
      description,
      roomType,
      occupancy,
      furnished,
      floor,
      roomSize,
      bathroomType,
      monthlyRent,
      securityDeposit,
      holdingDeposit,
      billsIncluded,
      status: status || "AVAILABLE",
      availableImmediately: availableImmediately || false,
      availableFrom: availableFrom || null,
      minimumTenancy: minimumTenancy || 6,
      maximumTenancy: maximumTenancy || null,
      roomAmenities: roomAmenities || [],
      propertyAmenities: propertyAmenities || [],
      wifiSpeed,
      images: images || [],
      featured: featured || false,
      isPublished: isPublished !== undefined ? isPublished : true,
      slug: uniqueSlug,
      notes,
    };

    // Create with a retry loop: if two rooms race and generate the same
    // listingCode, regenerate and try again a few times before giving up.
    let room;
    for (let attempt = 0; attempt < 5; attempt++) {
      const listingCode = await generateRoomCode();
      try {
        room = await Room.create({ ...basePayload, listingCode });
        break;
      } catch (err) {
        const isListingCodeDup =
          err.code === 11000 && err.keyPattern && err.keyPattern.listingCode;
        if (isListingCodeDup && attempt < 4) continue; // collided — retry
        throw err;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Room created successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);

    // Surface Mongoose validation errors (e.g. invalid enum value) so the
    // client sees the real reason instead of a generic 500.
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    // Duplicate unique key (slug / listingCode)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `Duplicate value for ${Object.keys(error.keyValue).join(", ")}.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create room.",
    });
  }
};

/**
 * Get Rooms with Filters and Pagination
 */
export const getRooms = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const {
      page = 1,
      limit = 10,
      search = "",
      propertyId,
      status,
      roomType,
      occupancy,
      furnished,
      minPrice,
      maxPrice,
      featured,
      isPublished,
      availableImmediately,
    } = req.query;

    const filter = { organizationId };

    if (propertyId) filter.propertyId = propertyId;
    if (status) filter.status = status;
    if (roomType) filter.roomType = roomType;
    if (occupancy) filter.occupancy = occupancy;
    if (furnished !== undefined) filter.furnished = furnished === "true";
    if (featured !== undefined) filter.featured = featured === "true";
    if (isPublished !== undefined) filter.isPublished = isPublished === "true";
    if (availableImmediately !== undefined) filter.availableImmediately = availableImmediately === "true";

    // Price range
    if (minPrice || maxPrice) {
      filter.monthlyRent = {};
      if (minPrice) filter.monthlyRent.$gte = Number(minPrice);
      if (maxPrice) filter.monthlyRent.$lte = Number(maxPrice);
    }

    // Search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { roomName: { $regex: search, $options: "i" } },
        { roomNumber: { $regex: search, $options: "i" } },
        { listingCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const rooms = await Room.find(filter)
      .populate("propertyId", "name propertyCode address")
      .populate("currentTenant", "firstName lastName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Room.countDocuments(filter);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      data: rooms,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms.",
    });
  }
};

/**
 * Get Single Room by ID
 */
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const room = await Room.findOne({
      _id: id,
      organizationId,
    })
      .populate("propertyId", "name propertyCode address rentalType")
      .populate("currentTenant", "firstName lastName email phone")
      .populate("createdBy", "firstName lastName email")
      .lean();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room.",
    });
  }
};

/**
 * Get Rooms by Property ID
 */
export const getRoomsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const organizationId = req.user.organizationId;

    // Verify property exists
    const property = await Property.findOne({
      _id: propertyId,
      organizationId,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const rooms = await Room.find({
      propertyId,
      organizationId,
    })
      .populate("currentTenant", "firstName lastName email phone")
      .sort({ roomNumber: 1, createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms.",
    });
  }
};

/**
 * Update Room
 */
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    // Prevent updates to occupied rooms
    if (room.status === "OCCUPIED" && req.body.status && req.body.status !== "OCCUPIED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update status of occupied room.",
      });
    }

    const {
      title,
      roomName,
      roomNumber,
      roomLabel,
      description,
      roomType,
      occupancy,
      furnished,
      floor,
      roomSize,
      bathroomType,
      monthlyRent,
      securityDeposit,
      holdingDeposit,
      billsIncluded,
      status,
      availableImmediately,
      availableFrom,
      minimumTenancy,
      maximumTenancy,
      roomAmenities,
      propertyAmenities,
      wifiSpeed,
      images,
      featured,
      isPublished,
      notes,
    } = req.body;

    // Update fields
    if (title) room.title = title;
    if (roomName) room.roomName = roomName;
    if (roomNumber !== undefined) room.roomNumber = roomNumber;
    if (roomLabel !== undefined) room.roomLabel = roomLabel;
    if (description !== undefined) room.description = description;
    if (roomType) room.roomType = roomType;
    if (occupancy) room.occupancy = occupancy;
    if (furnished !== undefined) room.furnished = furnished;
    if (floor !== undefined) room.floor = floor;
    if (roomSize !== undefined) room.roomSize = roomSize;
    if (bathroomType) room.bathroomType = bathroomType;
    if (monthlyRent) room.monthlyRent = monthlyRent;
    if (securityDeposit !== undefined) room.securityDeposit = securityDeposit;
    if (holdingDeposit !== undefined) room.holdingDeposit = holdingDeposit;
    if (billsIncluded) room.billsIncluded = { ...room.billsIncluded, ...billsIncluded };
    if (status) room.status = status;
    if (availableImmediately !== undefined) room.availableImmediately = availableImmediately;
    if (availableFrom !== undefined) room.availableFrom = availableFrom;
    if (minimumTenancy) room.minimumTenancy = minimumTenancy;
    if (maximumTenancy !== undefined) room.maximumTenancy = maximumTenancy;
    if (roomAmenities) room.roomAmenities = roomAmenities;
    if (propertyAmenities) room.propertyAmenities = propertyAmenities;
    if (wifiSpeed !== undefined) room.wifiSpeed = wifiSpeed;
    if (images) room.images = images;
    if (featured !== undefined) room.featured = featured;
    if (isPublished !== undefined) room.isPublished = isPublished;
    if (notes !== undefined) room.notes = notes;

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room updated successfully.",
      data: room,
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
      message: "Failed to update room.",
    });
  }
};

/**
 * Delete Room
 */
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    // Prevent deletion of occupied or reserved rooms
    if (["OCCUPIED", "RESERVED"].includes(room.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete occupied or reserved room.",
      });
    }

    await room.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete room.",
    });
  }
};

/**
 * Update Room Status
 */
export const updateRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.user.organizationId;

    const validStatuses = ["AVAILABLE", "AVAILABLE_SOON", "RESERVED", "OCCUPIED", "MAINTENANCE"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be AVAILABLE, AVAILABLE_SOON, RESERVED, OCCUPIED, or MAINTENANCE.",
      });
    }

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    room.status = status;
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room status updated successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room status.",
    });
  }
};

/**
 * Update Room Pricing
 */
export const updateRoomPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyRent, securityDeposit, holdingDeposit } = req.body;
    const organizationId = req.user.organizationId;

    if (!monthlyRent && securityDeposit === undefined && holdingDeposit === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one pricing field is required.",
      });
    }

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    if (monthlyRent) room.monthlyRent = monthlyRent;
    if (securityDeposit !== undefined) room.securityDeposit = securityDeposit;
    if (holdingDeposit !== undefined) room.holdingDeposit = holdingDeposit;

    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room pricing updated successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update room pricing.",
    });
  }
};

/**
 * Toggle Room Featured Status
 */
export const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    room.featured = !room.featured;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room ${room.featured ? "featured" : "unfeatured"} successfully.`,
      data: room,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle featured status.",
    });
  }
};

/**
 * Toggle Room Publish Status
 */
export const togglePublish = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const room = await Room.findOne({
      _id: id,
      organizationId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    room.isPublished = !room.isPublished;
    await room.save();

    return res.status(200).json({
      success: true,
      message: `Room ${room.isPublished ? "published" : "unpublished"} successfully.`,
      data: room,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle publish status.",
    });
  }
};

/**
 * Get Available Rooms Count
 */
export const getAvailableRoomsCount = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const [total, available, occupied, reserved, maintenance] = await Promise.all([
      Room.countDocuments({ organizationId }),
      Room.countDocuments({ organizationId, status: "AVAILABLE" }),
      Room.countDocuments({ organizationId, status: "OCCUPIED" }),
      Room.countDocuments({ organizationId, status: "RESERVED" }),
      Room.countDocuments({ organizationId, status: "MAINTENANCE" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        available,
        occupied,
        reserved,
        maintenance,
        occupancyRate: total > 0 ? ((occupied / total) * 100).toFixed(2) : 0,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch room statistics.",
    });
  }
};