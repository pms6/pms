// routes/member.route.js
import express from "express";
import { MemberController } from "../controllers/member.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Member management routes
router.post("/invite", MemberController.invite);
router.get("/my-org", MemberController.getMyOrganization);

// Organization member routes
router.get("/:organizationId", MemberController.getAll);
router.put("/:memberId", MemberController.update);
router.patch("/:memberId/activate", MemberController.activate); // Activate member
router.patch("/:memberId/suspend", MemberController.suspend); // Suspend member
router.delete("/:memberId", MemberController.delete);

export default router;