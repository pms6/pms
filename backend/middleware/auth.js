// middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Tenant from "../models/Tenant.js";
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

    // 4. If user is an Organization member (OWNER/MANAGER/AGENT/FINANCE),
    //    resolve their org + role from the membership record. This works for
    //    ALL team members, not just the owner — every org query downstream
    //    scopes on req.user.organizationId, so it MUST be set here.
    if (req.user.role === "Organization") {
      const member = await OrganizationMember.findOne({ userId: req.user._id });
      if (member) {
        req.user.organizationId = member.organizationId;
        req.user.organizationRole = member.role; // OWNER | MANAGER | AGENT | FINANCE
        req.user.memberStatus = member.status;
      } else {
        // Legacy fallback: owner who has an Organization doc but no member record
        const organization = await Organization.findOne({ userId: req.user._id });
        if (organization) {
          req.user.organizationId = organization._id;
          req.user.organizationRole = "OWNER";
        }
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