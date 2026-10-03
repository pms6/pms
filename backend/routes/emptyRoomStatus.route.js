// routes/emptyRoomStatus.route.js
import express from "express";
import {
  getEmptyRooms,
  getEmptyRoomById,
  createEmptyRoom,
  updateEmptyRoom,
  patchEmptyRoom,
  deleteEmptyRoom,
} from "../controllers/emptyRoomStatus.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

// CRUD
router.get("/", getEmptyRooms);
router.get("/:id", getEmptyRoomById);
router.post("/", createEmptyRoom);
router.put("/:id", updateEmptyRoom);
router.patch("/:id", patchEmptyRoom);
router.delete("/:id", deleteEmptyRoom);

export default router;
