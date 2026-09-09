// routes/clientDatabase.route.js
//
// The client database is its own register, kept by hand. It used to be a
// read-only view over CheckIn — a client was edited on their check-in record —
// but the two are independent now, so this owns full CRUD over its own rows.
import express from "express";
import {
  getClientDatabase,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clientDatabase.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, staffOnly);

router.get("/", getClientDatabase);
router.get("/:id", getClientById);
router.post("/", createClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);

export default router;
