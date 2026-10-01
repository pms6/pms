// routes/invoice.route.js
import express from "express";
import {
  getInvoiceOptions,
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  issueInvoice,
  addPayment,
  removePayment,
  cancelInvoice,
  deleteInvoice,
  getInvoicePdf,
  sendInvoice,
} from "../controllers/invoice.controller.js";
import { protect, staffRoles } from "../middleware/auth.js";

const router = express.Router();

// Owner / admin, managers and the finance team.
router.use(protect, staffRoles("OWNER", "ADMIN", "MANAGER", "FINANCE"));

router.get("/options", getInvoiceOptions);

router.get("/", getInvoices);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.put("/:id", updateInvoice);
router.delete("/:id", deleteInvoice);

router.get("/:id/pdf", getInvoicePdf);
router.post("/:id/issue", issueInvoice);
router.post("/:id/cancel", cancelInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/payments", addPayment);
router.delete("/:id/payments/:paymentId", removePayment);

export default router;
