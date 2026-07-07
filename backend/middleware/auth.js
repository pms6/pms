// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import env from "../config/env.js";

export const protect = async (req, res, next) => {
  try {
    // 1. Get token from cookies
    const token = req.cookies.token;

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

    // 4. If user is Organization, fetch their organizationId
    if (req.user.role === "Organization") {
      const organization = await Organization.findOne({ userId: req.user._id });
      if (organization) {
        req.user.organizationId = organization._id;
      }
    }

    // 5. If user is Tenant, fetch their organizationId (if they belong to one)
    if (req.user.role === "Tenant") {
      const tenant = await Tenant.findOne({ userId: req.user._id });
      if (tenant && tenant.organizationId) {
        req.user.organizationId = tenant.organizationId;
      }
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
};