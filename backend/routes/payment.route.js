// routes/payment.route.js
import express from "express";
import {
  getMyPayments,
  payCharge,
  confirmCharge,
} from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// The signed-in tenant's rent charges + summary
router.get("/my", getMyPayments);

// Tenant reports a payment against one of their own charges. This records a
// claim awaiting confirmation — it does NOT mark the charge paid.
router.post("/:id/pay", payCharge);

// Operator confirms or rejects that claim. Confirming is what marks it paid.
router.patch("/:id/confirm", confirmCharge);

export default router;
