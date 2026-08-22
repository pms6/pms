// routes/public.route.js
//
// Public marketing / listings API. These endpoints are intentionally NOT behind
// `protect` so anonymous visitors can browse. The ONE exception is POST
// /enquiries, which requires a signed-in user (sign-in gate on the request
// form) — `protect` is applied to that route only.

import express from "express";
import {
  getPublicProperties,
  getPeublicPropertyById,
  getPublicRooms,
  createEnquiry,
} from "../controllers/public.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public reads
router.get("/properties", getPublicProperties);
router.get("/properties/:id", getPeublicPropertyById);
router.get("/rooms", getPublicRooms);

// Enquiry / viewing request — sign-in required
router.post("/enquiries", protect, createEnquiry);

export default router;
