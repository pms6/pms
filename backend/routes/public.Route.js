// routes/public.route.js
//
// Public marketing / listings API. These endpoints are intentionally NOT behind
// `protect` so anonymous visitors can browse. The ONE exception is POST
// /enquiries, which requires a signed-in user (sign-in gate on the request
// form) — `protect` is applied to that route only.

import express from "express";
import rateLimit from "express-rate-limit";
import {
  getPublicProperties,
  getPeublicPropertyById,
  getPublicRooms,
  createEnquiry,
} from "../controllers/public.controller.js";
import {
  getPublicOrganizations,
  getPublicOrganization,
  createPublicProperty,
  createPublicPropertiesBulk,
} from "../controllers/publicListing.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public reads
router.get("/properties", getPublicProperties);
router.get("/properties/:id", getPeublicPropertyById);
router.get("/rooms", getPublicRooms);

// Enquiry / viewing request — sign-in required
router.post("/enquiries", protect, createEnquiry);

// ---------------------------------------------------------------------------
// "List your property with us" — the public page an outside letting agent or
// landlord fills in for a particular organization. Properties created here go
// live immediately, so both writes are rate limited per IP.
// ---------------------------------------------------------------------------

const listingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many properties added from this address. Please try again later.",
  },
});

// A CSV import sends ONE property per request so the browser can show which
// property is being saved and which files are being copied into Cloudinary.
// That means the request count tracks the number of properties imported, hence
// a much higher ceiling than the single-property form — it still caps an
// anonymous address at a few hundred properties an hour.
const bulkListingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many imports from this address. Please try again later.",
  },
});

router.get("/organizations", getPublicOrganizations);
router.get("/organizations/:slug", getPublicOrganization);

// Bulk first: "/properties/bulk" must not be swallowed by "/properties".
router.post(
  "/organizations/:slug/properties/bulk",
  bulkListingLimiter,
  createPublicPropertiesBulk
);
router.post("/organizations/:slug/properties", listingLimiter, createPublicProperty);

export default router;
