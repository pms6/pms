// routes/inventory.route.js
import express from "express";
import {
  getInventory,
  getInventoryScopes,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../controllers/inventory.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Property + room pickers for the add/edit form. Declared before the
// scope-addressed routes so "scopes" isn't read as a scopeType.
router.get("/scopes", getInventoryScopes);

router.get("/", getInventory);
router.post("/", createInventoryItem);

// An item is addressed by the scope that owns it plus its own id.
router.put("/:scopeType/:scopeId/:itemId", updateInventoryItem);
router.delete("/:scopeType/:scopeId/:itemId", deleteInventoryItem);

export default router;
