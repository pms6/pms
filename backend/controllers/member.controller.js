// controllers/member.controller.js
import mongoose from "mongoose";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import bcrypt from "bcrypt";
import env from "../config/env.js";
import { sendEmail } from "../utils/sendEmail.js";

// Only OWNER/MANAGER may manage the team (invite/update/activate/suspend/delete).
const canManageTeam = (req) =>
    ["OWNER", "MANAGER"].includes(req.user?.organizationRole);

// The caller's own organization (set by the `protect` middleware).
const callerOrgId = (req) =>
    req.user?.organizationId ? String(req.user.organizationId) : null;

// Generate random password
const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

export const MemberController = {
    // 1. Invite new member
    invite: async (req, res) => {
        try {
            const { email, role, name } = req.body;

            // Only OWNER/MANAGER may invite.
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            // Tenant isolation: always invite into the CALLER's org — never
            // trust an organizationId from the request body.
            const organizationId = callerOrgId(req);
            if (!organizationId) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of any organization"
                });
            }

            // Validate organization exists
            const organization = await Organization.findById(organizationId);
            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: "Organization not found"
                });
            }

            // STEP 1: Check if user exists in User model
            let user = await User.findOne({ email });
            let newPassword = null;

            if (!user) {
                // User doesn't exist - Create new user
                newPassword = generatePassword();
                const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
                const hashedPassword = await bcrypt.hash(newPassword, salt);

                // Create user with role "Organization"
                user = await User.create({
                    email,
                    password: hashedPassword,
                    role: "Organization",
                    isVerified: true
                });
            } else {
                // User exists - Check if user is Tenant
                if (user.role === "Tenant") {
                    return res.status(400).json({
                        success: false,
                        message: "Tenant users cannot be added as organization members"
                    });
                }

                // Check if user is already a member of THIS organization
                const existingMember = await OrganizationMember.findOne({ 
                    organizationId, 
                    userId: user._id 
                });
                
                if (existingMember) {
                    return res.status(400).json({ 
                        success: false,
                        message: "User is already a member of this organization" 
                    });
                }

                // Removing a team member deletes the OrganizationMember row but
                // leaves the User account behind. Re-inviting that address then
                // lands here, and the invite used to send "you already have an
                // account" — except the password was only ever shown in the
                // original invite email, so nobody could log in.
                //
                // A user with no membership anywhere is exactly that orphan, so
                // issue fresh credentials. Someone who IS a member of another
                // organization keeps their existing password: they have a
                // working login and it is not ours to reset.
                const otherMemberships = await OrganizationMember.countDocuments({
                    userId: user._id
                });

                if (otherMemberships === 0) {
                    newPassword = generatePassword();
                    const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
                    user.password = await bcrypt.hash(newPassword, salt);
                    user.isVerified = true;
                    await user.save();
                }
            }

            // STEP 2: Create organization member record
            const member = await OrganizationMember.create({
                organizationId,
                userId: user._id,
                role: role || "AGENT",
                status: "INVITED"
            });

            // STEP 3: Send email with credentials
            const loginLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;
            
            await sendEmail({
                email,
                subject: `You've been invited to join ${organization.name} as ${role || "AGENT"}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #F47C3C;">Welcome to ${organization.name}!</h2>
                        <p>You've been invited to join as a <strong>${role || "AGENT"}</strong>.</p>
                        
                        ${newPassword ? `
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Your Email:</strong> ${email}</p>
                                <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 8px;">${newPassword}</code></p>
                            </div>
                            <p style="font-size: 14px; color: #666;">Please change your password after logging in.</p>
                        ` : `
                            <p style="color: #666; margin: 20px 0;">You already have an account. Login with your existing credentials.</p>
                        `}
                        
                        <p style="color: #666; margin: 20px 0;">Your account is currently <strong>INVITED</strong>. An administrator will activate your account shortly.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${loginLink}" style="background: #F47C3C; color: white; padding: 12px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Login Now
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #999;">If you didn't request this, please ignore this email.</p>
                    </div>
                `
            });

            res.status(201).json({ 
                success: true,
                message: "Invitation sent successfully",
                data: member 
            });

        } catch (error) {
            console.error("Invite error:", error);
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // 2. Get all members of an organization
    getAll: async (req, res) => {
        try {
            const { organizationId } = req.params;

            if (!mongoose.isValidObjectId(organizationId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid organization id"
                });
            }

            // Tenant isolation: you may only list members of YOUR org.
            if (!callerOrgId(req) || organizationId !== callerOrgId(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized for this organization"
                });
            }

            const members = await OrganizationMember.find({
                organizationId
            }).populate("userId", "email");

            res.status(200).json({
                success: true,
                data: members
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // 3. Update member (role or status)
    update: async (req, res) => {
        try {
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            const { role, status } = req.body;

            const member = await OrganizationMember.findById(req.params.memberId);
            if (!member) {
                return res.status(404).json({
                    success: false,
                    message: "Member not found"
                });
            }

            // Tenant isolation: the target must be in the caller's org.
            if (String(member.organizationId) !== callerOrgId(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized for this member"
                });
            }

            if (role) member.role = role;
            if (status) member.status = status;
            await member.save();
            await member.populate("userId", "email");

            res.status(200).json({
                success: true,
                data: member
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // 4. Activate member (change status from INVITED to ACTIVE)
    activate: async (req, res) => {
        try {
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            const { memberId } = req.params;

            const member = await OrganizationMember.findById(memberId);
            if (!member) {
                return res.status(404).json({
                    success: false,
                    message: "Member not found"
                });
            }

            // Tenant isolation: the target must be in the caller's org.
            if (String(member.organizationId) !== callerOrgId(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized for this member"
                });
            }

            if (member.status === "ACTIVE") {
                return res.status(400).json({
                    success: false,
                    message: "Member is already active"
                });
            }

            // Update status to ACTIVE
            member.status = "ACTIVE";
            await member.save();

            // Populate for response
            await member.populate("userId", "email");
            
            // Get organization details
            const organization = await Organization.findById(member.organizationId);
            const user = await User.findById(member.userId);

            // Send activation notification
            if (user && user.email) {
                await sendEmail({
                    email: user.email,
                    subject: `Your account is now active in ${organization?.name || 'the organization'}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #F47C3C;">Account Activated!</h2>
                            <p>Your account has been activated for <strong>${organization?.name || 'the organization'}</strong>.</p>
                            <p>You now have <strong>${member.role}</strong> permissions.</p>
                            <p>You can now access your dashboard and start working.</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
                                   style="background: #F47C3C; color: white; padding: 12px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    Go to Dashboard
                                </a>
                            </div>
                        </div>
                    `
                });
            }

            res.status(200).json({ 
                success: true,
                message: "Member activated successfully",
                data: member 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // 5. Suspend member
    suspend: async (req, res) => {
        try {
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            const { memberId } = req.params;

            const member = await OrganizationMember.findById(memberId);
            if (!member) {
                return res.status(404).json({
                    success: false,
                    message: "Member not found"
                });
            }

            // Tenant isolation: the target must be in the caller's org.
            if (String(member.organizationId) !== callerOrgId(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized for this member"
                });
            }

            // You cannot suspend your own account.
            if (String(member.userId) === String(req.user._id)) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot suspend your own account"
                });
            }

            // The organization owner cannot be suspended.
            if (member.role === "OWNER") {
                return res.status(400).json({
                    success: false,
                    message: "The organization owner cannot be suspended"
                });
            }

            if (member.status === "SUSPENDED") {
                return res.status(400).json({
                    success: false,
                    message: "Member is already suspended"
                });
            }

            member.status = "SUSPENDED";
            await member.save();

            await member.populate("userId", "email");

            res.status(200).json({ 
                success: true,
                message: "Member suspended successfully",
                data: member 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // 6. Delete member
    delete: async (req, res) => {
        try {
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            const member = await OrganizationMember.findById(req.params.memberId);

            if (!member) {
                return res.status(404).json({
                    success: false,
                    message: "Member not found"
                });
            }

            // Tenant isolation: the target must be in the caller's org.
            if (String(member.organizationId) !== callerOrgId(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized for this member"
                });
            }

            // You cannot delete your own account.
            if (String(member.userId) === String(req.user._id)) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot delete your own account"
                });
            }

            // The organization owner cannot be deleted.
            if (member.role === "OWNER") {
                return res.status(400).json({
                    success: false,
                    message: "The organization owner cannot be removed"
                });
            }

            await member.deleteOne();

            res.status(200).json({
                success: true,
                message: "Member removed successfully"
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    },

    // 7. Get my organization info
    getMyOrganization: async (req, res) => {
        try {
            const member = await OrganizationMember.findOne({ 
                userId: req.user._id 
            }).populate("organizationId");
            
            if (!member) {
                return res.status(404).json({
                    success: false,
                    message: "You are not a member of any organization"
                });
            }
            
            res.status(200).json({ 
                success: true,
                data: {
                    organization: member.organizationId,
                    role: member.role,
                    status: member.status
                }
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: error.message 
            });
        }
    }
};