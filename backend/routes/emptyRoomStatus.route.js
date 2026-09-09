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
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// CRUD
router.get("/", getEmptyRooms);
router.get("/:id", getEmptyRoomById);
router.post("/", createEmptyRoom);
router.put("/:id", updateEmptyRoom);
router.patch("/:id", patchEmptyRoom);
router.delete("/:id", deleteEmptyRoom);

export default router;
