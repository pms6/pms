// controllers/public.controller.js
//
// PUBLIC (unauthenticated) listing endpoints for the marketing site / home page.
// Unlike every other controller, these are NOT scoped to req.user.organizationId
// — they expose ACTIVE properties and AVAILABLE, published rooms across ALL
// organizations so anonymous visitors can browse. Nothing here mutates data
// except createEnquiry, which DOES require a signed-in user (see routes).

import Property from "../models/Property.js";
import Room from "../models/Room.js";
import Organization from "../models/Organization.js";
import Lead from "../models/Lead.js";
import Onboarding from "../models/Onboarding.js";

// Onboarding stageIndex at which an applicant is considered "in review" — i.e.
// advanced past the initial "Application" stage (index 0) into "Referencing"
// and beyond. Once here, the tenant has committed and can't request others.
const REVIEW_STAGE_INDEX = 1;

// Statuses that count as "you can enquire about this room now".
const OPEN_ROOM_STATUSES = ["AVAILABLE", "AVAILABLE_SOON"];

/**
 * GET /public/properties
 * List active, non-deleted properties with availability stats and a "from"
 * price (the cheapest available room). Supports basic search + rentalType
 * filtering and pagination.
 */
export const getPublicProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = "",
      rentalType,
      city,
    } = req.query;

    const filter = {
      isDeleted: false,
      status: "ACTIVE",
    };

    if (rentalType) filter.rentalType = rentalType;
    if (city) filter["address.city"] = { $regex: city, $options: "i" };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
        { "address.postcode": { $regex: search, $options: "i" } },
        { "address.line1": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const data = await Promise.all(
      properties.map(async (property) => {
        const [total, available, availableSoon, cheapest] = await Promise.all([
          Room.countDocuments({ propertyId: property._id, isPublished: true }),
          Room.countDocuments({ propertyId: property._id, isPublished: true, status: "AVAILABLE" }),
          Room.countDocuments({ propertyId: property._id, isPublished: true, status: "AVAILABLE_SOON" }),
          Room.findOne({
            propertyId: property._id,
            isPublished: true,
            status: { $in: OPEN_ROOM_STATUSES },
          })
            .sort({ monthlyRent: 1 })
            .select("monthlyRent")
            .lean(),
        ]);

        return {
          ...property,
          roomStats: { total, available, availableSoon },
          minRent: cheapest ? cheapest.monthlyRent : null,
        };
      })
    );

    const total = await Property.countDocuments(filter);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
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
 * GET /public/properties/:id
 * A single active property with its published, still-open rooms and a light
 * "operator" (organization) card. Used by the public property detail page.
 */
export const getPeublicPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findOne({
      _id: id,
      isDeleted: false,
      status: "ACTIVE",
    }).lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const [total, available, availableSoon] = await Promise.all([
      Room.countDocuments({ propertyId: property._id, isPublished: true }),
      Room.countDocuments({ propertyId: property._id, isPublished: true, status: "AVAILABLE" }),
      Room.countDocuments({ propertyId: property._id, isPublished: true, status: "AVAILABLE_SOON" }),
    ]);

    // Only surface rooms a visitor could actually enquire about.
    const rooms = await Room.find({
      propertyId: property._id,
      isPublished: true,
      status: { $in: OPEN_ROOM_STATUSES },
    })
      .sort({ monthlyRent: 1 })
      .lean();

    const operator = await Organization.findById(property.organizationId)
      .select("name logo phone type")
      .lean();

    const minRent = rooms.length ? rooms[0].monthlyRent : null;

    return res.status(200).json({
      success: true,
      data: {
        ...property,
        roomStats: { total, available, availableSoon },
        rooms,
        minRent,
        operator: operator || null,
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
 * GET /public/rooms
 * All published rooms that are open (AVAILABLE / AVAILABLE_SOON) across every
 * organization — powers the "all available rooms" grid on the home page.
 */
export const getPublicRooms = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = "",
      roomType,
      minPrice,
      maxPrice,
    } = req.query;

    const filter = {
      isPublished: true,
      status: { $in: OPEN_ROOM_STATUSES },
    };

    if (roomType) filter.roomType = roomType;

    if (minPrice || maxPrice) {
      filter.monthlyRent = {};
      if (minPrice) filter.monthlyRent.$gte = Number(minPrice);
      if (maxPrice) filter.monthlyRent.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { roomName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const rooms = await Room.find(filter)
      .populate("propertyId", "name rentalType coverImage address")
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
      totalPages: Math.ceil(total / Number(limit)),
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
 * POST /public/enquiries
 * Create a website enquiry / viewing request. REQUIRES a signed-in user (the
 * route applies `protect`). The owning organization is taken from the property
 * being enquired about — NOT from the visitor — because a prospective tenant
 * does not belong to the landlord's org.
 */
export const createEnquiry = async (req, res) => {
  try {
    // Only tenants may send enquiries. Organization members (owners, managers,
    // agents, finance) manage listings — they don't enquire about them.
    if (req.user.role !== "Tenant") {
      return res.status(403).json({
        success: false,
        message: "Only tenant accounts can send enquiries.",
      });
    }

    // If the tenant already has an application in review (an onboarding that has
    // advanced past "Application"), they've committed to a property and can't
    // request other properties until that concludes.
    const tenantEmail = (req.user.email || "").toLowerCase();
    const inReview = tenantEmail
      ? await Onboarding.findOne({
          email: tenantEmail,
          isDeleted: false,
          stageIndex: { $gte: REVIEW_STAGE_INDEX },
        })
          .select("_id")
          .lean()
      : null;

    if (inReview) {
      return res.status(403).json({
        success: false,
        message:
          "Your application is already in review, so you can't request other properties right now.",
      });
    }

    const {
      propertyId,
      roomId,
      name,
      email,
      phone,
      message,
      preferredDate,
      preferredTime,
      budget,
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Your name is required.",
      });
    }

    const property = await Property.findOne({
      _id: propertyId,
      isDeleted: false,
    })
      .select("name organizationId")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    // Optionally resolve the room to enrich the "interested in" text and to get
    // a validated roomId we can dedupe on.
    let roomLabel = "";
    let validRoomId = null;
    if (roomId) {
      const room = await Room.findOne({ _id: roomId, propertyId })
        .select("title roomName")
        .lean();
      if (room) {
        roomLabel = ` — ${room.title || room.roomName}`;
        validRoomId = room._id;
      }
    }

    // Block a duplicate request: the same tenant may enquire about DIFFERENT
    // rooms, but not send a second request for one they already have an open
    // (or already-accepted) request on. A previously "lost" request may be
    // re-sent. roomId null = a whole-property (non-HMO) request.
    const duplicate = await Lead.findOne({
      organizationId: property.organizationId,
      createdBy: req.user._id,
      propertyId: property._id,
      roomId: validRoomId,
      isDeleted: false,
      status: { $ne: "lost" },
    }).lean();

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          duplicate.status === "converted"
            ? "Your request for this room has already been accepted — check your onboarding."
            : "You've already sent a request for this room. The operator will be in touch soon.",
      });
    }

    // Fold the free-text viewing details into the lead's notes so the operator
    // sees everything on the existing Leads board (no schema change needed).
    const noteParts = [];
    if (message) noteParts.push(message);
    if (preferredDate) noteParts.push(`Preferred date: ${preferredDate}`);
    if (preferredTime) noteParts.push(`Preferred time: ${preferredTime}`);
    noteParts.push(`Submitted by account: ${req.user.email}`);

    const lead = await Lead.create({
      organizationId: property.organizationId,
      createdBy: req.user._id,
      propertyId: property._id,
      roomId: validRoomId,
      name,
      email: email || req.user.email,
      phone,
      source: "Website",
      interestedIn: `${property.name}${roomLabel}`,
      budget: budget ? Number(budget) : 0,
      status: "new",
      notes: noteParts.join("\n"),
    });

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been sent. The operator will be in touch.",
      data: { id: lead._id },
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
      message: "Failed to submit enquiry.",
    });
  }
};
