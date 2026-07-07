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
} from "../controllers/room.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();


// Apply protect middleware to all routes
router.use(protect);

// Room statistics
router.get("/stats/available", getAvailableRoomsCount);

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