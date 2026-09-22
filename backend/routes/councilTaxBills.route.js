// routes/councilTaxBills.route.js
import express from "express";
import { councilTax, bills } from "../controllers/councilTaxBills.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// staffOnly as well as protect: the council tax sheet holds tenants' dates of
// birth, phone numbers and emails, which a tenant account must never read.
router.use(protect, staffOnly);

// Council tax sheet
router.get("/council-tax", councilTax.list);
router.post("/council-tax", councilTax.create);
router.put("/council-tax/:id", councilTax.update);
router.delete("/council-tax/:id", councilTax.remove);

// Bills record sheet
router.get("/bills", bills.list);
router.post("/bills", bills.create);
router.put("/bills/:id", bills.update);
router.delete("/bills/:id", bills.remove);

export default router;
