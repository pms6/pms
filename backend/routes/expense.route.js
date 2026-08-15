// routes/expense.route.js
import express from "express";
import {
  getExpenses,
  getMonthlyExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expense.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// Monthly sheet — fixed path, so it must precede any "/:id" route.
router.get("/monthly", getMonthlyExpenses);

// CRUD
router.get("/", getExpenses);
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

export default router;
