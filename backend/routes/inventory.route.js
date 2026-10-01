// routes/inventory.route.js
import express from "express";
import {
  getInventory,
  getInventoryScopes,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../controllers/inventory.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff only: protect() also resolves an organizationId for tenant accounts,
// which would otherwise let a tenant read the whole organisation's records.
router.use(protect, staffOnly);

// Property + room pickers for the add/edit form. Declared before the
// scope-addressed routes so "scopes" isn't read as a scopeType.
router.get("/scopes", getInventoryScopes);

router.get("/", getInventory);
router.post("/", createInventoryItem);

// An item is addressed by the scope that owns it plus its own id.
router.put("/:scopeType/:scopeId/:itemId", updateInventoryItem);
router.delete("/:scopeType/:scopeId/:itemId", deleteInventoryItem);

export default router;
