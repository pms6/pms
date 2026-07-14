// controllers/auth.controller.js
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js"; // ✅ CORRECT import (uppercase)
import bcrypt from "bcrypt";
import env from "../config/env.js";
import sendTokenResponse from "../utils/sendTokenResponse.js";
import { sendEmail } from "../utils/sendEmail.js";

// @desc    Register user & Send Real OTP via Email
// @route   POST /api/v1/auth/register
export const register = async (req, res) => {
  try {
    const { email, password, targetRole } = req.body;

    if (!email || !password || !targetRole) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      email,
      password: hashedPassword,
      otp: mockOtp,
      otpExpire,
    });

    try {
      await sendEmail({
        email: user.email,
        subject: "Your Account Verification Code",
        html: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 500px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #333;">Welcome!</h2>
            <p>Please use the verification code below to activate your account profile:</p>
            <h1 style="color: #4A90E2; letter-spacing: 4px; background: #f4f6f8; padding: 10px; text-align: center; border-radius: 4px;">${mockOtp}</h1>
            <p style="font-size: 12px; color: #666;">This code will expire in 10 minutes.</p>
          </div>
        `,
      });
    } catch (mailError) {
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ message: "Verification email failed to send. Process aborted." });
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email for the verification OTP.",
      targetRole 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP and Create specific Profile
// @route   POST /api/v1/auth/verify-otp
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, targetRole } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== otp || new Date() > user.otpExpire) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.role = targetRole; 
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    let profileData = null;

    if (targetRole === "Tenant") {
      profileData = await Tenant.create({ userId: user._id });
    } else if (targetRole === "Organization") {
      // Create the organization
      profileData = await Organization.create({ 
        userId: user._id,
        name: `${user.email.split('@')[0]}'s Organization`
      });
      
      // ✅ Create OrganizationMember record for the owner
      await OrganizationMember.create({
        organizationId: profileData._id,
        userId: user._id,
        role: "OWNER",
        status: "ACTIVE"
      });
    }

    // Send token response with organization data
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Error in verifyOtp:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User
// @route   POST /api/v1/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Account is not verified yet. Please complete OTP verification." });
    }

    // Auto-activate an invited team member on their first login.
    // An organization member is created as INVITED when invited; logging in
    // with the emailed credentials flips them to ACTIVE (no admin step needed).
    // Only INVITED members are touched — SUSPENDED members are NOT reactivated.
    if (user.role === "Organization") {
      await OrganizationMember.updateOne(
        { userId: user._id, status: "INVITED" },
        { $set: { status: "ACTIVE" } }
      );
    }

    await sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout / Clear Cookie
// @route   POST /api/v1/auth/logout
export const logout = async (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// @desc    Get logged in user and respective Profile details
// @route   GET /api/v1/auth/me
export const getMe = async (req, res) => {
  try {
    let profileData = null;
    let organizationRole = null;
    let organizationId = null;
    let organizationName = null;
    let memberStatus = null;

    if (req.user.role === "Tenant") {
      profileData = await Tenant.findOne({ userId: req.user._id });
    } else if (req.user.role === "Organization") {
      // Get the organization profile
      profileData = await Organization.findOne({ userId: req.user._id });
      
      // ✅ Check if user has an OrganizationMember record
      const member = await OrganizationMember.findOne({ 
        userId: req.user._id
      }).populate('organizationId');
      
      if (member) {
        // User is a member (could be OWNER, MANAGER, AGENT, FINANCE)
        organizationRole = member.role;
        organizationId = member.organizationId?._id || profileData?._id;
        organizationName = member.organizationId?.name || profileData?.name;
        memberStatus = member.status;
      } else if (profileData) {
        // User is an organization owner but no member record yet (legacy)
        // Create one for them
        const newMember = await OrganizationMember.create({
          organizationId: profileData._id,
          userId: req.user._id,
          role: "OWNER",
          status: "ACTIVE"
        });
        organizationRole = "OWNER";
        organizationId = profileData._id;
        organizationName = profileData.name;
        memberStatus = "ACTIVE";
      }
    }

    // Create user object with organization role
    const userResponse = req.user.toObject ? req.user.toObject() : req.user;
    
    res.status(200).json({
      success: true,
      user: {
        ...userResponse,
        organizationRole: organizationRole || null,
        organizationId: organizationId || null,
        organizationName: organizationName || null,
        memberStatus: memberStatus || null
      },
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete / update the tenant personal profile
// @route   PATCH /api/v1/auth/profile
// @access  Private (Tenant)
export const updateProfile = async (req, res) => {
  try {
    if (req.user.role !== "Tenant") {
      return res
        .status(403)
        .json({ message: "Only tenant profiles can be updated via this endpoint" });
    }

    const {
      firstName,
      lastName,
      birthdate,
      gender,
      profileImage,
      about,
      occupationType,
      jobTitle,
      interests,
      budget,
      moveInDate,
      organizationId,
    } = req.body;

    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (birthdate !== undefined) updates.birthdate = birthdate;
    if (gender !== undefined) updates.gender = gender;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (about !== undefined) updates.about = about;
    if (occupationType !== undefined) updates.occupationType = occupationType;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (interests !== undefined) updates.interests = interests;
    if (budget !== undefined) updates.budget = budget;
    if (moveInDate !== undefined) updates.moveInDate = moveInDate;
    if (organizationId !== undefined) updates.organizationId = organizationId;

    const profile = await Tenant.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================
// NEW: Update Organization Info
// =============================================
export const updateOrganization = async (req, res) => {
  try {
    if (req.user.role !== "Organization") {
      return res
        .status(403)
        .json({ message: "Only organization accounts can update organization info" });
    }

    const {
      name,
      legalName,
      phone,
      address,
      logo,
      units,
      planType,
      fastTrack,
      type,           // AGENCY / LANDLORD
      businessType,   // BUSINESS / INDIVIDUAL
    } = req.body;

    // Find the organization linked to this user
    let organization = await Organization.findOne({ userId: req.user._id });

    if (!organization) {
      // Fallback: Create if somehow missing (shouldn't happen after verifyOtp)
      organization = await Organization.create({ 
        userId: req.user._id,
        name: name || `${req.user.email.split('@')[0]}'s Organization`
      });
    }

    // Build update object (only fields that are sent)
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (legalName !== undefined) updates.legalName = legalName;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (logo !== undefined) updates.logo = logo;
    if (units !== undefined) updates.units = units;
    if (planType !== undefined) updates.planType = planType;
    if (fastTrack !== undefined) updates.fastTrack = fastTrack;
    if (type !== undefined) updates.type = type;
    if (businessType !== undefined) updates.businessType = businessType;

    // Update the organization
    const updatedOrg = await Organization.findByIdAndUpdate(
      organization._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Organization information updated successfully",
      organization: updatedOrg,
    });
  } catch (error) {
    console.error("Error in updateOrganization:", error);
    res.status(500).json({ message: error.message });
  }
};