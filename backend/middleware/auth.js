// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Tenant from "../models/Tenant.js";
import env from "../config/env.js";

export const protect = async (req, res, next) => {
  try {
    // 1. Get token from cookie OR Authorization header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, env.jwt.accessSecret);

    // 3. Attach user to request
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    // 4. Organization member resolution
    if (req.user.role === "Organization") {
      const member = await OrganizationMember.findOne({ userId: req.user._id });
      if (member) {
        req.user.organizationId = member.organizationId;
        req.user.organizationRole = member.role;
        req.user.memberStatus = member.status;
      } else {
        const organization = await Organization.findOne({ userId: req.user._id });
        if (organization) {
          req.user.organizationId = organization._id;
          req.user.organizationRole = "OWNER";
        }
      }
    }

    // 5. Tenant organizationId
    if (req.user.role === "Tenant") {
      const tenant = await Tenant.findOne({ userId: req.user._id });
      if (tenant?.organizationId) {
        req.user.organizationId = tenant.organizationId;
      }
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};