// controllers/publicListing.controller.js
//
// The "list your property with us" flow.
//
// A letting agent or a landlord opens the organization's public page
// (/list-property/<organization-name>) and either fills the form in for one
// property or uploads a spreadsheet of them. Either way the property, its
// owner and its rooms are created LIVE straight away — there is no review
// queue in front of them.
//
// That makes these handlers the only unauthenticated writers into Property /
// Room / Owner, so two rules matter:
//   1. organizationId comes from the URL slug, never from the request body.
//   2. every value is pinned to the enum/type its model expects before it is
//      stored (see the coercion block below).
// Whoever holds an organization's link can therefore add properties to it, so
// treat the link itself as the access control.

import Property from "../models/Property.js";
import Room from "../models/Room.js";
import Owner from "../models/Owner.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import OrganizationMember from "../models/OrganizationMember.js";
import { findOrganizationBySlug, slugifyOrgName } from "../utils/orgSlug.js";
import { generatePropertyCode, generateRoomCode, uniqueRoomSlug } from "../utils/codes.js";
import { mirrorPropertyMedia } from "../utils/cloudinaryMirror.js";
import { sendEmail } from "../utils/sendEmail.js";
// ---------------------------------------------------------------------------
// Input coercion
//
// Everything below runs on anonymous input, so each value is pinned to the
// enum/type the model expects rather than trusted. An out-of-range value falls
// back to the default instead of failing the whole submission — a stray enum is
// not worth losing a property someone spent ten minutes typing.
// ---------------------------------------------------------------------------

const str = (value, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const oneOf = (value, allowed, fallback = undefined) =>
  allowed.includes(value) ? value : fallback;

const bool = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

// null means "not answered", which several schema fields model explicitly.
const triState = (value) => (typeof value === "boolean" ? value : null);

const num = (value, fallback = null) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const date = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const list = (value, allowed, max = 50) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => allowed.includes(v)))].slice(0, max)
    : [];

// Only accept URLs we could actually render — the gallery goes straight onto a
// tenant-facing page, so a "javascript:" or "data:" src has no business here.
const httpUrl = (value) => {
  const raw = str(value, 500);
  return /^https?:\/\//i.test(raw) ? raw : "";
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const MAX_ROOMS = 40;
// One CSV upload. Enough for a decent portfolio, small enough that the
// sequential creates below stay inside a normal request.
const MAX_BULK_PROPERTIES = 100;
const MAX_IMAGES = 30;
const MAX_DOCUMENTS = 20;
const MAX_INVENTORY_ITEMS = 200;

const RENTAL_TYPES = ["HMO", "SINGLE_LET", "SHORT_TERM", "BLOCK"];
const TENANT_TYPES = ["ANY", "PROFESSIONAL", "STUDENT", "SOCIAL"];
const TRANSPORT_MINUTES = ["0-5", "5-10", "10-15", "15-20", "20-30", "30+"];
const TRANSPORT_MODES = ["walk", "bus", "train", "tube", "tram"];
const PROPERTY_AMENITY_VALUES = [
  "parking",
  "garden_patio",
  "garage",
  "balcony_terrace",
  "disabled_access",
];
const AGREEMENT_TYPES = ["AST", "COMPANY_LET", "LICENCE", "LODGER", "OTHER"];
const RENT_PERIODS = ["MONTHLY", "WEEKLY"];
const DEPOSIT_SCHEMES = ["NONE", "DPS", "MYDEPOSITS", "TDS"];
const DOCUMENT_TYPES = [
  "CONTRACT",
  "INSURANCE",
  "INVENTORY",
  "FLOOR_PLAN",
  "LICENCE",
  "OTHER",
];
const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR"];
const ROOM_TYPES = ["STANDARD", "ENSUITE", "STUDIO", "MASTER", "DOUBLE", "SINGLE"];
const OCCUPANCIES = ["SINGLE", "DOUBLE", "TWIN", "FAMILY"];
const BATHROOM_TYPES = ["private", "shared"];
const BILLS_OPTIONS = ["YES", "NO", "SOME"];
const ROOM_STATUSES = [
  "AVAILABLE",
  "AVAILABLE_SOON",
  "RESERVED",
  "OCCUPIED",
  "MAINTENANCE",
];
const DAYS_AVAILABLE = ["SEVEN_DAYS", "WEEKDAYS", "WEEKENDS"];
const ROOM_AMENITY_VALUES = [
  "single_bed",
  "double_bed",
  "desk",
  "chair",
  "wardrobe",
  "tv",
  "balcony",
  "ensuite_bathroom",
  "lockable_room",
  "chest_of_drawers",
  "mirror",
];
const SHARED_AMENITY_VALUES = [
  "wifi",
  "washing_machine",
  "dryer",
  "dishwasher",
  "shared_kitchen",
  "parking",
  "garden",
  "lift",
  "gym",
  "security",
  "cctv",
  "cleaning_service",
  "bike_storage",
];
const SMOKING = ["NO_PREFERENCE", "YES", "NO"];
const GENDERS = ["ANY", "MALE", "FEMALE"];
const OCCUPATIONS = ["STUDENTS_ONLY", "NO_STUDENTS", "ALL"];
const PETS = ["NO_PREFERENCE", "YES", "NO"];
const SUBMITTER_ROLES = ["AGENT", "LANDLORD", "OTHER"];

const cleanInventory = (inventory = {}) => ({
  checkedOn: date(inventory.checkedOn),
  checkedBy: str(inventory.checkedBy, 120),
  items: (Array.isArray(inventory.items) ? inventory.items : [])
    .slice(0, MAX_INVENTORY_ITEMS)
    .map((item) => ({
      item: str(item.item, 160),
      location: str(item.location, 120),
      quantity: num(item.quantity, 1),
      condition: oneOf(item.condition, CONDITIONS, "GOOD"),
      price: num(item.price, null),
      notes: str(item.notes, 500),
    }))
    .filter((item) => item.item),
});

const cleanRoom = (room = {}) => {
  const roomName = str(room.roomName, 120) || str(room.title, 120);

  return {
    roomName,
    title: str(room.title, 160) || roomName,
    roomNumber: str(room.roomNumber, 40),
    roomLabel: str(room.roomLabel, 80),
    description: str(room.description, 4000),

    roomType: oneOf(room.roomType, ROOM_TYPES, "STANDARD"),
    occupancy: oneOf(room.occupancy, OCCUPANCIES, "SINGLE"),
    furnished: bool(room.furnished, true),
    floor: str(room.floor, 40),
    roomSize: str(room.roomSize, 40),
    bathroomType: oneOf(room.bathroomType, BATHROOM_TYPES, "shared"),

    monthlyRent: num(room.monthlyRent, null),
    rentPeriod: oneOf(room.rentPeriod, RENT_PERIODS, "MONTHLY"),
    securityDeposit: num(room.securityDeposit, null),
    holdingDeposit: num(room.holdingDeposit, null),

    billsOption: oneOf(room.billsOption, BILLS_OPTIONS, "SOME"),
    billsIncluded: {
      electricity: bool(room.billsIncluded?.electricity, false),
      gas: bool(room.billsIncluded?.gas, false),
      water: bool(room.billsIncluded?.water, false),
      wifi: bool(room.billsIncluded?.wifi, false),
      internet: bool(room.billsIncluded?.internet, false),
      councilTax: bool(room.billsIncluded?.councilTax, false),
    },

    status: oneOf(room.status, ROOM_STATUSES, "AVAILABLE"),
    availableImmediately: bool(room.availableImmediately, false),
    availableFrom: date(room.availableFrom),
    minimumTenancy: num(room.minimumTenancy, 6),
    maximumTenancy: num(room.maximumTenancy, null),
    shortTermLets: bool(room.shortTermLets, false),
    daysAvailable: oneOf(room.daysAvailable, DAYS_AVAILABLE, "SEVEN_DAYS"),
    referencesRequired: triState(room.referencesRequired),

    roomAmenities: list(room.roomAmenities, ROOM_AMENITY_VALUES),
    propertyAmenities: list(room.propertyAmenities, SHARED_AMENITY_VALUES),
    wifiSpeed: str(room.wifiSpeed, 40),

    images: (Array.isArray(room.images) ? room.images : [])
      .slice(0, MAX_IMAGES)
      .map((image) => ({
        url: httpUrl(typeof image === "string" ? image : image?.url),
        alt: str(typeof image === "string" ? "" : image?.alt, 160),
      }))
      .filter((image) => image.url),

    preferences: {
      smoking: oneOf(room.preferences?.smoking, SMOKING, "NO_PREFERENCE"),
      gender: oneOf(room.preferences?.gender, GENDERS, "ANY"),
      occupation: oneOf(room.preferences?.occupation, OCCUPATIONS, "ALL"),
      pets: oneOf(room.preferences?.pets, PETS, "NO"),
      minAge: num(room.preferences?.minAge, null),
      maxAge: num(room.preferences?.maxAge, null),
      language: str(room.preferences?.language, 60),
      couplesWelcome: bool(room.preferences?.couplesWelcome, false),
      vegetarianPreferred: bool(room.preferences?.vegetarianPreferred, false),
    },

    inventory: cleanInventory(room.inventory),

    notes: str(room.notes, 2000),
  };
};

const cleanPropertyInput = (body = {}) => {
  const property = body.property || {};
  const photos = (Array.isArray(property.gallery) ? property.gallery : [])
    .map(httpUrl)
    .filter(Boolean)
    .slice(0, MAX_IMAGES);

  return {
    submittedBy: {
      role: oneOf(body.submittedBy?.role, SUBMITTER_ROLES, "AGENT"),
      name: str(body.submittedBy?.name, 120),
      company: str(body.submittedBy?.company, 160),
      email: str(body.submittedBy?.email, 160).toLowerCase(),
      phone: str(body.submittedBy?.phone, 40),
    },

    owner: {
      name: str(body.owner?.name, 120),
      company: bool(body.owner?.company, false),
      email: str(body.owner?.email, 160).toLowerCase(),
      phone: str(body.owner?.phone, 40),
      bank: { account: str(body.owner?.bank?.account, 60) },
      notes: str(body.owner?.notes, 2000),
    },

    property: {
      name: str(property.name, 160),
      rentalType: oneOf(property.rentalType, RENTAL_TYPES, "HMO"),
      tenantType: oneOf(property.tenantType, TENANT_TYPES, "ANY"),
      ownerName: str(property.ownerName, 120) || str(body.owner?.name, 120),

      address: {
        line1: str(property.address?.line1, 200),
        line2: str(property.address?.line2, 200),
        area: str(property.address?.area, 120),
        city: str(property.address?.city, 120),
        county: str(property.address?.county, 120),
        postcode: str(property.address?.postcode, 20),
        country: str(property.address?.country, 80) || "United Kingdom",
      },

      // Only keep a coordinate pair when both halves are real numbers.
      ...(num(property.location?.lat, null) !== null &&
      num(property.location?.lng, null) !== null
        ? {
            location: {
              lat: num(property.location.lat),
              lng: num(property.location.lng),
            },
          }
        : {}),

      description: str(property.description, 8000),

      // Transport only means something once a station is named, otherwise it
      // would persist a stray "0-5 minutes walk from".
      ...(str(property.transport?.station, 120)
        ? {
            transport: {
              minutes: oneOf(property.transport?.minutes, TRANSPORT_MINUTES, "0-5"),
              mode: oneOf(property.transport?.mode, TRANSPORT_MODES, "walk"),
              station: str(property.transport.station, 120),
            },
          }
        : {}),

      livingRoom: triState(property.livingRoom),
      amenities: list(property.amenities, PROPERTY_AMENITY_VALUES),

      contract: {
        agreementType: oneOf(property.contract?.agreementType, AGREEMENT_TYPES, "AST"),
        startDate: date(property.contract?.startDate),
        endDate: date(property.contract?.endDate),
        rentAmount: num(property.contract?.rentAmount, null),
        rentPeriod: oneOf(property.contract?.rentPeriod, RENT_PERIODS, "MONTHLY"),
        noticeMonths: num(property.contract?.noticeMonths, 1),
        depositScheme: oneOf(property.contract?.depositScheme, DEPOSIT_SCHEMES, "NONE"),
        depositAmount: num(property.contract?.depositAmount, null),
        landlordName: str(property.contract?.landlordName, 120),
        tenantName: str(property.contract?.tenantName, 120),
        rollsToPeriodic: bool(property.contract?.rollsToPeriodic, true),
        notes: str(property.contract?.notes, 4000),
      },

      inventory: cleanInventory(property.inventory),

      documents: (Array.isArray(property.documents) ? property.documents : [])
        .slice(0, MAX_DOCUMENTS)
        .map((doc) => ({
          name: str(doc?.name, 200),
          url: httpUrl(doc?.url),
          type: oneOf(doc?.type, DOCUMENT_TYPES, "OTHER"),
        }))
        .filter((doc) => doc.url),

      // The first photo is the cover, matching the in-app property form.
      coverImage: httpUrl(property.coverImage) || photos[0] || "",
      gallery: httpUrl(property.coverImage) ? photos : photos.slice(1),
    },

    rooms: (Array.isArray(body.rooms) ? body.rooms : [])
      .slice(0, MAX_ROOMS)
      .map(cleanRoom)
      .filter((room) => room.roomName && room.monthlyRent !== null),

    message: str(body.message, 4000),
  };
};


// ---------------------------------------------------------------------------
// Creating the live records
// ---------------------------------------------------------------------------

/** The user new records are attributed to: the organization's owner account. */
const organizationOwnerUser = async (organization) => {
  const member = await OrganizationMember.findOne({
    organizationId: organization._id,
    role: "OWNER",
  })
    .select("userId")
    .lean();

  if (member?.userId) return member.userId;
  if (organization.userId) return organization.userId;
  return null;
};

/** That owner's email address, for the "a property was added" notification. */
const organizationEmail = async (organization) => {
  const userId = await organizationOwnerUser(organization);
  if (!userId) return "";
  const user = await User.findById(userId).select("email").lean();
  return user?.email || "";
};

/**
 * Reuse the organization's existing Owner of that name, or create one.
 * Matching on name is what the in-app owner picker does, so a portfolio
 * uploaded under one landlord ends up on a single Owner record.
 */
const upsertOwner = async ({ organizationId, createdBy, owner, propertyName }) => {
  const name = owner?.name;
  if (!name) return null;

  const existing = await Owner.findOne({ organizationId, name, isDeleted: false });

  if (existing) {
    if (!existing.properties.includes(propertyName)) {
      existing.properties.push(propertyName);
      await existing.save();
    }
    return existing;
  }

  return Owner.create({
    organizationId,
    createdBy,
    name,
    company: owner.company || false,
    email: owner.email || "",
    phone: owner.phone || "",
    status: "in_progress",
    properties: [propertyName],
    bank: { account: owner.bank?.account || "" },
    notes: owner.notes || "",
  });
};

/**
 * Create one live property with its owner and rooms.
 *
 * @param {object} args
 * @param {object} args.organization the organization it belongs to
 * @param {object} args.createdBy    user id the records are attributed to
 * @param {object} args.payload      output of cleanPropertyInput
 * @param {string} args.via          "PUBLIC_FORM" | "CSV_IMPORT"
 * @returns {Promise<{property: object, rooms: object[]}>}
 * @throws  {Error} with `.status` 409 when the name is already taken
 */
const createLiveProperty = async ({ organization, createdBy, payload, via }) => {
  const organizationId = organization._id;

  // Property names are unique per organization in the in-app create flow, so a
  // clash is reported rather than silently duplicated — this is also what makes
  // re-running the same import safe.
  const clash = await Property.findOne({
    organizationId,
    name: payload.property.name,
    isDeleted: false,
  })
    .select("_id")
    .lean();

  if (clash) {
    const error = new Error(
      `A property called "${payload.property.name}" already exists.`
    );
    error.status = 409;
    throw error;
  }

  // Photos and paperwork arrive as links to wherever the sender hosts them.
  // Copy them into our own Cloudinary account first, so the listing does not
  // depend on a third party's server staying up. Done after the name check so a
  // duplicate property does not upload a megabyte of images for nothing.
  const media = await mirrorPropertyMedia(payload);

  const ownerName = payload.owner?.name || payload.property.ownerName || "";
  const owner = await upsertOwner({
    organizationId,
    createdBy,
    owner: { ...payload.owner, name: ownerName },
    propertyName: payload.property.name,
  });

  const { contract, ...propertyRest } = payload.property;

  let property;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      property = await Property.create({
        ...propertyRest,
        contract: {
          ...contract,
          // Reminder settings are an in-app preference; keep the platform
          // defaults rather than inheriting anything from a public form.
          autoReminder: true,
          reminderDaysBefore: 30,
        },
        organizationId,
        createdBy,
        ownerId: owner?._id || null,
        ownerName,
        // There is no review step, so submissions land live.
        status: "ACTIVE",
        // Who sent it in — the only record of that now the review queue is gone.
        source: {
          via,
          name: payload.submittedBy.name,
          company: payload.submittedBy.company,
          email: payload.submittedBy.email,
          phone: payload.submittedBy.phone,
          role: payload.submittedBy.role,
          receivedAt: new Date(),
        },
        propertyCode: await generatePropertyCode(),
      });
      break;
    } catch (err) {
      const isCodeDup = err.code === 11000 && err.keyPattern?.propertyCode;
      if (isCodeDup && attempt < 4) continue;
      throw err;
    }
  }

  const rooms = [];
  for (const room of payload.rooms) {
    let created;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await Room.create({
          ...room,
          organizationId,
          propertyId: property._id,
          createdBy,
          title: room.title || room.roomName,
          isPublished: true,
          slug: await uniqueRoomSlug(`${payload.property.name}-${room.roomName}`),
          listingCode: await generateRoomCode(),
        });
        break;
      } catch (err) {
        const isDup =
          err.code === 11000 && (err.keyPattern?.listingCode || err.keyPattern?.slug);
        if (isDup && attempt < 4) continue;
        throw err;
      }
    }
    if (created) rooms.push(created);
  }

  return { property, rooms, media };
};

/**
 * Tell the organization a property was added. Best effort — a dead SMTP box
 * must not fail work that is already saved.
 */
const notifyOrganization = async (organization, submittedBy, created) => {
  try {
    const email = await organizationEmail(organization);
    if (!email) return;

    const list = created
      .map(
        ({ property, rooms }) =>
          `<li>${property.propertyCode} — ${property.name}${
            rooms.length ? ` (${rooms.length} rooms)` : ""
          }</li>`
      )
      .join("");

    const plural = created.length === 1 ? "property" : "properties";

    await sendEmail({
      email,
      subject: `${created.length} ${plural} added by ${submittedBy.name}`,
      html: `
        <p><strong>${submittedBy.name}</strong>${
          submittedBy.company ? ` (${submittedBy.company})` : ""
        } added ${created.length} ${plural} to ${
          organization.name || "your organization"
        }, and they are live now.</p>
        <ul>${list}</ul>
        <p><strong>Contact:</strong> ${submittedBy.email}${
          submittedBy.phone ? ` · ${submittedBy.phone}` : ""
        }</p>
        <p>Open <em>Properties</em> in your dashboard to review or edit them.</p>
      `,
    });
  } catch (error) {
    console.error("Listing notification failed:", error.message);
  }
};

/** Shared validation for one property payload. Returns "" when it is fine. */
const validatePayload = (payload) => {
  if (!payload.property.name) return "Property name is required.";
  if (!payload.property.address.line1) return "Property address is required.";
  if (
    payload.property.contract.startDate &&
    payload.property.contract.endDate &&
    payload.property.contract.endDate < payload.property.contract.startDate
  ) {
    return "Contract end date cannot be before the start date.";
  }
  return "";
};

// ---------------------------------------------------------------------------
// PUBLIC — organization lookup
// ---------------------------------------------------------------------------

/**
 * GET /public/organizations
 * The directory behind the picker on /list-property: every organization that
 * can receive a property, with the slug its page lives at.
 *
 * Unauthenticated, so it returns only what a public listing page already shows
 * — name, logo, type. Organizations with no name are skipped: their URL would
 * be an opaque id that means nothing in a dropdown.
 */
export const getPublicOrganizations = async (req, res) => {
  try {
    const { search = "", limit = 200 } = req.query;

    const filter = { name: { $nin: [null, ""] } };
    if (search) filter.name = { $regex: search, $options: "i" };

    const organizations = await Organization.find(filter)
      .select("name logo type")
      .sort({ name: 1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .lean();

    const data = organizations
      .map((organization) => ({
        name: organization.name,
        slug: slugifyOrgName(organization.name),
        logo: organization.logo || "",
        type: organization.type || null,
      }))
      // A name of only punctuation slugifies to "" — nothing to link to.
      .filter((organization) => organization.slug);

    return res.status(200).json({ success: true, total: data.length, data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to load organizations.",
    });
  }
};

/**
 * GET /public/organizations/:slug
 * The light branding card the public page needs (name, logo, type).
 * Deliberately narrow — this is unauthenticated.
 */
export const getPublicOrganization = async (req, res) => {
  try {
    const organization = await findOrganizationBySlug(req.params.slug);

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: organization._id,
        name: organization.name || "",
        slug: slugifyOrgName(organization.name) || String(organization._id),
        logo: organization.logo || "",
        type: organization.type || null,
        phone: organization.phone || "",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to load organization.",
    });
  }
};

// ---------------------------------------------------------------------------
// PUBLIC — creating properties
// ---------------------------------------------------------------------------

/** Resolve the organization + the user to attribute records to, or reply 404. */
const resolveTarget = async (req, res) => {
  const organization = await findOrganizationBySlug(req.params.slug);

  if (!organization) {
    res.status(404).json({ success: false, message: "Organization not found." });
    return null;
  }

  const createdBy = await organizationOwnerUser(organization);

  if (!createdBy) {
    // Property.createdBy is required, so there is nothing sensible to store.
    res.status(409).json({
      success: false,
      message:
        "This organization has no owner account yet, so properties cannot be added to it.",
    });
    return null;
  }

  return { organization, createdBy };
};

/**
 * POST /public/organizations/:slug/properties
 * One property from the form — created live, with its owner and rooms.
 */
export const createPublicProperty = async (req, res) => {
  try {
    const target = await resolveTarget(req, res);
    if (!target) return;

    const payload = cleanPropertyInput(req.body);

    if (!payload.submittedBy.name) {
      return res.status(400).json({ success: false, message: "Your name is required." });
    }
    if (!isEmail(payload.submittedBy.email)) {
      return res
        .status(400)
        .json({ success: false, message: "A valid email address is required." });
    }

    const invalid = validatePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { property, rooms } = await createLiveProperty({
      organization: target.organization,
      createdBy: target.createdBy,
      payload,
      via: "PUBLIC_FORM",
    });

    await notifyOrganization(target.organization, payload.submittedBy, [
      { property, rooms },
    ]);

    return res.status(201).json({
      success: true,
      message: "Property added successfully.",
      data: {
        propertyCode: property.propertyCode,
        propertyId: property._id,
        rooms: rooms.length,
        organization: target.organization.name || "",
      },
    });
  } catch (error) {
    console.error(error);

    if (error.status === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }

    return res.status(500).json({ success: false, message: "Failed to add property." });
  }
};

/**
 * POST /public/organizations/:slug/properties/bulk
 * A CSV upload: many properties, one sender, one request.
 *
 * A bad entry is reported and skipped rather than failing the batch — an agent
 * importing 40 properties should not lose 39 of them to one missing address.
 * Creation is sequential because the code generators read the highest existing
 * PROP-/RM- value.
 */
export const createPublicPropertiesBulk = async (req, res) => {
  try {
    const target = await resolveTarget(req, res);
    if (!target) return;

    const submittedBy = {
      role: oneOf(req.body?.submittedBy?.role, SUBMITTER_ROLES, "AGENT"),
      name: str(req.body?.submittedBy?.name, 120),
      company: str(req.body?.submittedBy?.company, 160),
      email: str(req.body?.submittedBy?.email, 160).toLowerCase(),
      phone: str(req.body?.submittedBy?.phone, 40),
    };

    if (!submittedBy.name) {
      return res.status(400).json({ success: false, message: "Your name is required." });
    }
    if (!isEmail(submittedBy.email)) {
      return res
        .status(400)
        .json({ success: false, message: "A valid email address is required." });
    }

    const incoming = Array.isArray(req.body?.properties) ? req.body.properties : [];

    if (incoming.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "The file contained no properties to import." });
    }
    if (incoming.length > MAX_BULK_PROPERTIES) {
      return res.status(400).json({
        success: false,
        message: `Please split the file — at most ${MAX_BULK_PROPERTIES} properties per upload.`,
      });
    }

    const results = [];
    const created = [];

    for (const [index, entry] of incoming.entries()) {
      const label = str(entry?.property?.name, 160) || `Property ${index + 1}`;

      try {
        const payload = cleanPropertyInput({ ...entry, submittedBy });

        const invalid = validatePayload(payload);
        if (invalid) {
          results.push({ name: label, ok: false, error: invalid });
          continue;
        }

        const outcome = await createLiveProperty({
          organization: target.organization,
          createdBy: target.createdBy,
          payload,
          via: "CSV_IMPORT",
        });

        created.push(outcome);
        results.push({
          name: outcome.property.name,
          ok: true,
          reference: outcome.property.propertyCode,
          propertyId: outcome.property._id,
          rooms: outcome.rooms.length,
          // How many photos/documents were copied into our Cloudinary account,
          // and how many kept a foreign URL because the copy failed.
          mirrored: outcome.media.mirrored,
          keptRemote: outcome.media.kept,
        });
      } catch (err) {
        console.error("Bulk row failed:", err.message);
        results.push({
          name: label,
          ok: false,
          error:
            err.status === 409
              ? err.message
              : err.name === "ValidationError"
              ? Object.values(err.errors)
                  .map((e) => e.message)
                  .join(", ")
              : "Could not save this property.",
        });
      }
    }

    if (created.length > 0) {
      // One email for the batch — an inbox with 40 identical notifications in
      // it is worse than useless.
      await notifyOrganization(target.organization, submittedBy, created);
    }

    return res.status(created.length > 0 ? 201 : 400).json({
      success: created.length > 0,
      message:
        created.length > 0
          ? `${created.length} of ${incoming.length} properties added.`
          : "None of the properties could be added.",
      data: {
        total: incoming.length,
        created: created.length,
        failed: incoming.length - created.length,
        organization: target.organization.name || "",
        results,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to import properties." });
  }
};
