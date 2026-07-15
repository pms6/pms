// routes/payment.route.js
import express from "express";
import { getMyPayments, payCharge } from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// The signed-in tenant's rent charges + summary
router.get("/my", getMyPayments);

// Record a payment against one of the tenant's own charges
router.post("/:id/pay", payCharge);

export default router;
