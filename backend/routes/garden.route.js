// routes/garden.route.js
import express from "express";
import { cutting, machines } from "../controllers/garden.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

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
