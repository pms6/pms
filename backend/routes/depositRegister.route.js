// routes/depositRegister.route.js
//
// Read-only: the register is a view over CheckIn and CheckOut, so a deposit is
// edited on whichever of those two records owns the figure.
import express from "express";
import { getDepositRegister } from "../controllers/depositRegister.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, staffOnly);

router.get("/", getDepositRegister);

export default router;
