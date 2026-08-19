// utils/sendTokenResponse.js
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Organization from "../models/Organization.js";

const sendTokenResponse = async (user, statusCode, res) => {
  try {
    // Uses centralized config values
    const token = jwt.sign(
      { id: user._id },
      env.jwt.accessSecret,
      {
        expiresIn: env.jwt.accessExpires,
      }
    );

    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: env.isProd,                    // false on localhost (HTTP)
      sameSite: env.isProd ? "None" : "Lax", // "None" only works with Secure + HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    // Get organization data if user is Organization
    let organizationRole = null;
    let organizationId = null;
    let organizationName = null;
    let memberStatus = null;

    if (user.role === "Organization") {
      // Check if user has an OrganizationMember record
      const member = await OrganizationMember.findOne({
        userId: user._id
      }).populate('organizationId');

      if (member) {
        // User is a member (could be OWNER, MANAGER, AGENT, FINANCE)
        organizationRole = member.role;
        organizationId = member.organizationId?._id;
        organizationName = member.organizationId?.name;
        memberStatus = member.status;
      } else {
        // If no member record, check if they're an organization owner
        const organization = await Organization.findOne({ userId: user._id });
        if (organization) {
          organizationId = organization._id;
          organizationName = organization.name;
          organizationRole = "OWNER";
          memberStatus = "ACTIVE";

          // Create member record for owner if it doesn't exist
          await OrganizationMember.create({
            organizationId: organization._id,
            userId: user._id,
            role: "OWNER",
            status: "ACTIVE"
          });
        }
      }
    }

    // Prepare user response
    const userResponse = {
      id: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      organizationRole: organizationRole || null,
      organizationId: organizationId || null,
      organizationName: organizationName || null,
      memberStatus: memberStatus || null,
    };

    res
      .status(statusCode)
      .cookie("token", token, cookieOptions)
      .json({
        success: true,
        token,
        user: userResponse,
      });
  } catch (error) {
    console.error("Error in sendTokenResponse:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default sendTokenResponse;