// routes/expense.route.js
import express from "express";
import {
  getExpenses,
  getMonthlyExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

// Monthly sheet — fixed path, so it must precede any "/:id" route.
router.get("/monthly", getMonthlyExpenses);

// CRUD
router.get("/", getExpenses);
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

export default router;
