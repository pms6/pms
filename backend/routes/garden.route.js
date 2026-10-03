// routes/garden.route.js
import express from "express";
import { cutting, machines } from "../controllers/garden.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

// Garden cutting log
router.get("/cuttings", cutting.list);
router.post("/cuttings", cutting.create);
router.put("/cuttings/:id", cutting.update);
router.delete("/cuttings/:id", cutting.remove);

// Garden machines sheet
router.get("/machines", machines.list);
router.post("/machines", machines.create);
router.put("/machines/:id", machines.update);
router.delete("/machines/:id", machines.remove);

export default router;
