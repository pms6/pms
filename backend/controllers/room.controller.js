// controllers/roomController.js
import Room from "../models/Room.js";
import Property from "../models/Property.js";
import Tenancy from "../models/Tenancy.js";
import Tenant from "../models/Tenant.js";
// RM-000001 sequencing lives in utils/codes.js so rooms created by approving a
// property submission land in the same sequence as rooms created in-app.
import { generateRoomCode } from "../utils/codes.js";

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
      rentPeriod,
      securityDeposit,
      holdingDeposit,
      billsOption,
      billsIncluded,
      status,
      availableImmediately,
      availableFrom,
      minimumTenancy,
      maximumTenancy,
      shortTermLets,
      daysAvailable,
      referencesRequired,
      roomAmenities,
      propertyAmenities,
      wifiSpeed,
      preferences,
      inventory,
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
      rentPeriod: rentPeriod || "MONTHLY",
      securityDeposit,
      holdingDeposit,
      billsOption: billsOption || "SOME",
      billsIncluded,
      status: status || "AVAILABLE",
      availableImmediately: availableImmediately || false,
      availableFrom: availableFrom || null,
      minimumTenancy: minimumTenancy || 6,
      maximumTenancy: maximumTenancy || null,
      shortTermLets: shortTermLets || false,
      daysAvailable: daysAvailable || "SEVEN_DAYS",
      referencesRequired: referencesRequired === undefined ? null : referencesRequired,
      roomAmenities: roomAmenities || [],
      propertyAmenities: propertyAmenities || [],
      wifiSpeed,
      preferences: preferences || {},
      inventory: inventory || {},
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
      rentPeriod,
      securityDeposit,
      holdingDeposit,
      billsOption,
      billsIncluded,
      status,
      availableImmediately,
      availableFrom,
      minimumTenancy,
      maximumTenancy,
      shortTermLets,
      daysAvailable,
      referencesRequired,
      roomAmenities,
      propertyAmenities,
      wifiSpeed,
      preferences,
      inventory,
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
    if (rentPeriod) room.rentPeriod = rentPeriod;
    if (securityDeposit !== undefined) room.securityDeposit = securityDeposit;
    if (holdingDeposit !== undefined) room.holdingDeposit = holdingDeposit;
    if (billsOption) room.billsOption = billsOption;
    if (billsIncluded) room.billsIncluded = { ...room.billsIncluded, ...billsIncluded };
    if (status) room.status = status;
    if (availableImmediately !== undefined) room.availableImmediately = availableImmediately;
    if (availableFrom !== undefined) room.availableFrom = availableFrom;
    if (minimumTenancy) room.minimumTenancy = minimumTenancy;
    if (maximumTenancy !== undefined) room.maximumTenancy = maximumTenancy;
    if (shortTermLets !== undefined) room.shortTermLets = shortTermLets;
    if (daysAvailable) room.daysAvailable = daysAvailable;
    if (referencesRequired !== undefined) room.referencesRequired = referencesRequired;
    if (roomAmenities) room.roomAmenities = roomAmenities;
    if (propertyAmenities) room.propertyAmenities = propertyAmenities;
    if (wifiSpeed !== undefined) room.wifiSpeed = wifiSpeed;
    if (preferences) room.preferences = { ...room.preferences, ...preferences };
    if (inventory !== undefined) room.inventory = inventory;
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

/**
 * GET /api/rooms/available
 * Returns two lists:
 *  - availableNow
 *  - comingSoon  (tenant leaving within `daysAhead` days)
 *
 * Query params:
 *  - organizationId (required for SaaS)
 *  - daysAhead (default 60) – how many days ahead to treat as "Coming Soon"
 */
export const getAvailableRooms = async (req, res) => {
  try {
    const organizationId = req.query.organizationId || req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required",
      });
    }

    const daysAhead = parseInt(req.query.daysAhead, 10) || 60;
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + daysAhead);

    // 1. Fetch rooms for this organization
    const rooms = await Room.find({
      organizationId,
      status: { $in: ["AVAILABLE", "AVAILABLE_SOON", "OCCUPIED", "RESERVED"] },
      isPublished: true, // remove this line if you also want unpublished rooms
    })
      .populate({
        path: "propertyId",
        select: "name propertyCode address rentalType status isDeleted",
        match: { isDeleted: { $ne: true }, status: { $ne: "ARCHIVED" } },
      })
      .populate({
        path: "currentTenant",
        select: "firstName lastName",
      })
      .lean();

    // Keep only rooms that still have a valid property
    const validRooms = rooms.filter((r) => r.propertyId);

    if (validRooms.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          availableNow: [],
          comingSoon: [],
          summary: {
            availableNowCount: 0,
            comingSoonCount: 0,
            daysAhead,
          },
        },
      });
    }

    const roomIds = validRooms.map((r) => r._id);

    // 2. Fetch active / ending tenancies for these rooms
    const tenancies = await Tenancy.find({
      organizationId,
      roomId: { $in: roomIds },
      isDeleted: { $ne: true },
      $or: [
        { status: { $in: ["Fixed Term", "Becoming Periodic", "Periodic", "Ending"] } },
        { fixedTermEnd: { $gte: now } },
        { periodicStart: { $ne: null } },
      ],
    })
      .populate({
        path: "tenantId",
        select: "firstName lastName",
      })
      .lean();

    // Map roomId → most relevant tenancy
    const tenancyByRoom = {};
    for (const t of tenancies) {
      if (!t.roomId) continue;
      const key = t.roomId.toString();

      if (
        !tenancyByRoom[key] ||
        (t.fixedTermEnd &&
          (!tenancyByRoom[key].fixedTermEnd ||
            t.fixedTermEnd > tenancyByRoom[key].fixedTermEnd))
      ) {
        tenancyByRoom[key] = t;
      }
    }

    const availableNow = [];
    const comingSoon = [];

    for (const room of validRooms) {
      const property = room.propertyId;
      const tenancy = tenancyByRoom[room._id.toString()];

      // Determine leave / available-from date
      let leaveDate = null;
      if (tenancy?.fixedTermEnd) {
        leaveDate = new Date(tenancy.fixedTermEnd);
      } else if (room.availableFrom) {
        leaveDate = new Date(room.availableFrom);
      }

      // Ex-tenant name
      let exTenantName = "—";
      if (tenancy?.tenantId) {
        exTenantName =
          `${tenancy.tenantId.firstName || ""} ${tenancy.tenantId.lastName || ""}`.trim() ||
          tenancy.tenant ||
          "—";
      } else if (room.currentTenant) {
        exTenantName =
          `${room.currentTenant.firstName || ""} ${room.currentTenant.lastName || ""}`.trim() ||
          "—";
      } else if (tenancy?.tenant) {
        exTenantName = tenancy.tenant;
      }

      // Pricing
      const rent = room.monthlyRent || 0;
      const deposit = room.securityDeposit != null ? room.securityDeposit : null;

      const priceStr =
        room.roomType === "ENSUITE" || room.bathroomType === "private"
          ? `Ensuite:£${rent}`
          : `DR=£${rent}`;

      const depositStr = deposit != null ? `£${deposit}` : "—";

      // Build row (matches your screenshot columns)
      const row = {
        propertyId: property._id,
        roomId: room._id,
        propertyName: property.name || property.address?.line1 || "—",
        code: property.propertyCode || property.address?.postcode || "—",
        area: property.address?.area || property.address?.city || "—",
        zone: null, // add to Property schema later if needed
        price: priceStr,
        deposit: depositStr,
        monthlyRent: rent,
        securityDeposit: deposit,
        exTenant: exTenantName,
        occupancy:
          room.occupancy === "DOUBLE" || room.occupancy === "TWIN"
            ? "Single/Double"
            : "Single",
        bank: null, // add to schema later if needed
        roomType: room.roomType,
        bathroomType: room.bathroomType,
        status: null, // set below
        availableFrom: leaveDate,
        availableImmediately: room.availableImmediately || false,
        roomStatus: room.status,
        shortTermLets: room.shortTermLets || false,
        minimumTenancy: room.minimumTenancy,
        title: room.title,
        roomName: room.roomName,
        listingCode: room.listingCode,
      };

      // Decision logic
      const isAvailableNow =
        room.status === "AVAILABLE" ||
        room.availableImmediately === true ||
        !tenancy ||
        (leaveDate && leaveDate <= now);

      const isComingSoon =
        leaveDate &&
        leaveDate > now &&
        leaveDate <= futureLimit &&
        (room.status === "OCCUPIED" ||
          room.status === "AVAILABLE_SOON" ||
          room.status === "RESERVED" ||
          !!tenancy);

      if (isAvailableNow) {
        row.status = "Available Now";
        if (room.shortTermLets) {
          row.notes = "Short Letting No Contract";
        }
        availableNow.push(row);
      } else if (isComingSoon) {
        // Format like "6-September-2026"
        const d = leaveDate;
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        row.status = `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
        comingSoon.push(row);
      }
      // else → still occupied far in the future → skip
    }

    // Sort
    comingSoon.sort(
      (a, b) => new Date(a.availableFrom) - new Date(b.availableFrom)
    );
    availableNow.sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0));

    return res.status(200).json({
      success: true,
      data: {
        availableNow,
        comingSoon,
        summary: {
          availableNowCount: availableNow.length,
          comingSoonCount: comingSoon.length,
          daysAhead,
        },
      },
    });
  } catch (error) {
    console.error("getAvailableRooms error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch available rooms",
      error: error.message,
    });
  }
};