// routes/clientDatabase.route.js
//
// Read-only: the client database is a view over CheckIn, Property and Room, so
// a client is edited on their check-in record.
import express from "express";
import { getClientDatabase } from "../controllers/clientDatabase.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, staffOnly);

router.get("/", getClientDatabase);

export default router;
