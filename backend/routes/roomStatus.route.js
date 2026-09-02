// routes/roomStatus.route.js
//
// Read-only: a room's status lives on the Room record and is changed there.
import express from "express";
import { getRoomStatusList } from "../controllers/roomStatus.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, staffOnly);

router.get("/", getRoomStatusList);

export default router;
