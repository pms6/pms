// routes/referenceData.route.js
import express from "express";
import {
  getReferenceData,
  getReferenceDataById,
  getTenantsWithoutReferences,
  createReferenceData,
  updateReferenceData,
  deleteReferenceData,
} from "../controllers/referenceData.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// References carry third parties' contact details — a previous landlord, an
// employer, a next of kin — so this is staff-only, like the other registers.
router.use(protect, staffOnly);

// Fixed path first, so it is not matched as an "/:id".
router.get("/without-references", getTenantsWithoutReferences);

router.get("/", getReferenceData);
router.get("/:id", getReferenceDataById);
router.post("/", createReferenceData);
router.put("/:id", updateReferenceData);
router.delete("/:id", deleteReferenceData);

export default router;
