// routes/inventoryReport.route.js
import express from "express";
import {
  getReportOptions,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getReports,
  getReport,
  createReport,
  updateReport,
  getReportPdf,
  finaliseReport,
  reopenReport,
  createCheckOutFrom,
  deleteReport,
} from "../controllers/inventoryReport.controller.js";
import { protect, staffRoles } from "../middleware/auth.js";

const router = express.Router();

// The owner and manager portals are the two with an Inventory section.
router.use(protect, staffRoles("OWNER", "ADMIN", "MANAGER"));

// Fixed paths before "/:id" so they are not read as an id.
router.get("/options", getReportOptions);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);

router.get("/", getReports);
router.post("/", createReport);
router.get("/:id", getReport);
router.put("/:id", updateReport);
router.delete("/:id", deleteReport);

router.get("/:id/pdf", getReportPdf);
router.post("/:id/finalise", finaliseReport);
router.post("/:id/reopen", reopenReport);
router.post("/:id/check-out", createCheckOutFrom);

export default router;
