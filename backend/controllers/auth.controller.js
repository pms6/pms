// controllers/auth.controller.js
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js"; // ✅ CORRECT import (uppercase)
import bcrypt from "bcrypt";
import env from "../config/env.js";
import sendTokenResponse from "../utils/sendTokenResponse.js";
import { sendEmail } from "../utils/sendEmail.js";
import {
  OTP_MAX_ATTEMPTS,
  cooldownRemaining,
  generateOtp,
  isOtpExpired,
  otpEmail,
  otpExpiry,
} from "../utils/otp.js";

const ROLES = ["Tenant", "Organization"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Look a user up by email, exact match first and case-insensitively second.
// Addresses were historically stored however the visitor typed them, so an
// exact-only lookup would strand anyone who capitalised differently on their
// second visit (and would happily mint a duplicate account for them).
const findUserByEmail = async (email) => {
  const trimmed = String(email || "").trim();
  if (!trimmed) return null;

  return (
    (await User.findOne({ email: trimmed })) ||
    (await User.findOne({ email: new RegExp(`^${escapeRegex(trimmed)}$`, "i") }))
  );
};

// Compare a submitted code against a stored one in a way that tolerates the
// stray whitespace a paste from an email client tends to carry.
const codesMatch = (stored, submitted) =>
  Boolean(stored) && stored === String(submitted || "").trim();

// @desc    Register user & Send Real OTP via Email
// @route   POST /api/v1/auth/register
export const register = async (req, res) => {
  try {
    const { email, password, targetRole } = req.body;

    if (!email || !password || !targetRole) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    if (!ROLES.includes(targetRole)) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    const existing = await findUserByEmail(email);
    if (existing?.isVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    // An unverified record left behind by an abandoned sign-up is reused rather
    // than rejected. Rejecting it would permanently lock the address out: the
    // visitor can never verify (they lost the code) and can never re-register.
    if (existing) {
      const wait = cooldownRemaining(existing.otpSentAt);
      if (wait > 0) {
        return res.status(429).json({
          message: `Please wait ${wait} second${wait === 1 ? "" : "s"} before requesting another code.`,
          retryAfter: wait,
        });
      }
    }

    const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOtp();
    const otpExpire = otpExpiry();

    let user;
    if (existing) {
      existing.password = hashedPassword;
      existing.otp = otp;
      existing.otpExpire = otpExpire;
      existing.otpSentAt = new Date();
      existing.otpAttempts = 0;
      user = await existing.save();
    } else {
      user = await User.create({
        email: String(email).trim(),
        password: hashedPassword,
        otp,
        otpExpire,
        otpSentAt: new Date(),
        otpAttempts: 0,
      });
    }

    try {
      await sendEmail({
        email: user.email,
        subject: "Your Account Verification Code",
        html: otpEmail({
          heading: "Welcome!",
          intro: "Please use the verification code below to activate your account profile:",
          code: otp,
        }),
      });
    } catch (mailError) {
      // Only bin the record when this request is what created it — deleting a
      // pre-existing account because a re-send bounced is worse than the bounce.
      if (!existing) await User.findByIdAndDelete(user._id);
      return res
        .status(502)
        .json({ message: "Verification email failed to send. Please try again." });
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

// @desc    Re-send the account verification OTP
// @route   POST /api/v1/auth/resend-otp
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide your email address" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No account found for that email address." });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "This account is already verified. Please sign in." });
    }

    const wait = cooldownRemaining(user.otpSentAt);
    if (wait > 0) {
      return res.status(429).json({
        message: `Please wait ${wait} second${wait === 1 ? "" : "s"} before requesting another code.`,
        retryAfter: wait,
      });
    }

    const otp = generateOtp();

    // Send first, persist second: a failed delivery must not invalidate the
    // code the visitor may still be holding from the previous email.
    try {
      await sendEmail({
        email: user.email,
        subject: "Your Account Verification Code",
        html: otpEmail({
          heading: "Here's your new code",
          intro: "Use the verification code below to activate your account profile:",
          code: otp,
        }),
      });
    } catch (mailError) {
      return res
        .status(502)
        .json({ message: "Could not send the verification code. Please try again." });
    }

    user.otp = otp;
    user.otpExpire = otpExpiry();
    user.otpSentAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({
      success: true,
      message: "A new verification code is on its way.",
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

    if (!email || !otp || !targetRole) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    if (!ROLES.includes(targetRole)) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "This account is already verified. Please sign in." });
    }

    if (isOtpExpired(user.otp, user.otpExpire)) {
      return res
        .status(400)
        .json({ message: "That code has expired. Please request a new one." });
    }

    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res
        .status(429)
        .json({ message: "Too many incorrect attempts. Please request a new code." });
    }

    if (!codesMatch(user.otp, otp)) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      const left = OTP_MAX_ATTEMPTS - user.otpAttempts;
      return res.status(400).json({
        message: left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      });
    }

    user.isVerified = true;
    user.role = targetRole;
    user.otp = undefined;
    user.otpExpire = undefined;
    user.otpSentAt = undefined;
    user.otpAttempts = 0;
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

    const user = await findUserByEmail(email);
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

// @desc    Start a password reset — emails a 6-digit code
// @route   POST /api/v1/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide your email address" });
    }

    // Deliberately identical whatever we find: whether an address is registered
    // is not something an anonymous caller gets to learn from this endpoint.
    const generic = {
      success: true,
      message: "If an account exists for that email, a reset code is on its way.",
    };

    const user = await findUserByEmail(email);

    // Unverified accounts have no password worth resetting — they finish
    // sign-up through the verification code instead.
    if (!user || !user.isVerified) {
      return res.status(200).json(generic);
    }

    // Inside the cooldown we simply don't send again; the caller still gets the
    // generic reply so the timing tells them nothing.
    if (cooldownRemaining(user.resetOtpSentAt) > 0) {
      return res.status(200).json(generic);
    }

    const otp = generateOtp();

    try {
      await sendEmail({
        email: user.email,
        subject: "Your Password Reset Code",
        html: otpEmail({
          heading: "Reset your password",
          intro: "Use the code below to choose a new password:",
          code: otp,
          footer: "If you didn't request this, you can safely ignore this email — your password stays unchanged.",
        }),
      });
    } catch (mailError) {
      return res
        .status(502)
        .json({ message: "Could not send the reset code. Please try again." });
    }

    user.resetOtp = otp;
    user.resetOtpExpire = otpExpiry();
    user.resetOtpSentAt = new Date();
    user.resetOtpAttempts = 0;
    await user.save();

    res.status(200).json(generic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check a reset code without consuming it (lets the UI advance a step)
// @route   POST /api/v1/auth/verify-reset-otp
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Please provide your email and the code" });
    }

    const user = await findUserByEmail(email);
    const check = await assertResetCode(user, otp);
    if (check.error) {
      return res.status(check.status).json({ message: check.error });
    }

    res.status(200).json({ success: true, message: "Code verified." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Finish a password reset
// @route   POST /api/v1/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res
        .status(400)
        .json({ message: "Please provide your email, the code and a new password" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await findUserByEmail(email);
    const check = await assertResetCode(user, otp);
    if (check.error) {
      return res.status(check.status).json({ message: check.error });
    }

    const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
    user.password = await bcrypt.hash(password, salt);
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;
    user.resetOtpSentAt = undefined;
    user.resetOtpAttempts = 0;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated. You can now sign in with your new password.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Shared validation for the two reset endpoints. Returns { error, status } on
// failure and an empty object when the code is good. Wrong guesses are counted
// so a 6-digit code can't be walked through at leisure.
async function assertResetCode(user, otp) {
  const invalid = { error: "Invalid or expired code.", status: 400 };

  // A missing user is reported the same as a bad code — see forgotPassword.
  if (!user || isOtpExpired(user.resetOtp, user.resetOtpExpire)) return invalid;

  if ((user.resetOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    return {
      error: "Too many incorrect attempts. Please request a new code.",
      status: 429,
    };
  }

  if (!codesMatch(user.resetOtp, otp)) {
    user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
    await user.save();
    const left = OTP_MAX_ATTEMPTS - user.resetOtpAttempts;
    return {
      error: left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
      status: 400,
    };
  }

  return {};
}

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
      // Renting preferences (mirrors the website request form).
      nationality,
      smoking,
      occupancy,
      pet,
      minimumStayMonths,
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
    if (nationality !== undefined) updates.nationality = nationality;
    if (smoking !== undefined) updates.smoking = smoking;
    if (occupancy !== undefined) updates.occupancy = occupancy;
    if (pet !== undefined) updates.pet = pet;
    if (minimumStayMonths !== undefined) {
      // "" from an unset <select> must clear the field, not fail the Number cast.
      const n = Number(minimumStayMonths);
      updates.minimumStayMonths = Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
    }

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