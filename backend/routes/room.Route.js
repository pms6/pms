// routes/roomRoutes.js
import express from "express";
import {
  createRoom,
  getRooms,
  getRoomById,
  getRoomsByProperty,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  updateRoomPricing,
  toggleFeatured,
  togglePublish,
  getAvailableRoomsCount,
  getAvailableRooms,
} from "../controllers/room.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();


// Rooms are an internal staff resource — a TENANT's organizationId (set by
// `protect` from their own Tenant record) must not let them list, create,
// edit or delete the organization's rooms.
router.use(protect, staffOnly);

// Room statistics
router.get("/stats/available", getAvailableRoomsCount);
router.get("/available", getAvailableRooms);

// Rooms by property
router.get("/property/:propertyId", getRoomsByProperty);

// CRUD operations
router.post("/", createRoom);
router.get("/", getRooms);
router.get("/:id", getRoomById);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

// Special operations
router.patch("/:id/status", updateRoomStatus);
router.patch("/:id/pricing", updateRoomPricing);
router.patch("/:id/toggle-featured", toggleFeatured);
router.patch("/:id/toggle-publish", togglePublish);

export default router;