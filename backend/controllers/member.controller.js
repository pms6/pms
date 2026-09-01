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

// Roles a team manager may hand out. OWNER is deliberately absent: an
// organization has exactly one owner and transferring that seat is a different
// operation, so it must never be reachable from a role dropdown.
const ASSIGNABLE_ROLES = ["MANAGER", "AGENT", "FINANCE"];

// Shared guard for every role change. Returns an { status, message } problem to
// send back, or null when the change is allowed.
const roleChangeProblem = (req, member, role) => {
    if (!ASSIGNABLE_ROLES.includes(role)) {
        return {
            status: 400,
            message: "Role must be one of: " + ASSIGNABLE_ROLES.join(", ")
        };
    }

    // Changing your own role would let a MANAGER promote themselves, or demote
    // themselves out of the team screen they are standing on.
    if (String(member.userId) === String(req.user._id)) {
        return { status: 400, message: "You cannot change your own role" };
    }

    // Demoting the owner would leave the organization without one.
    if (member.role === "OWNER") {
        return {
            status: 400,
            message: "The organization owner's role cannot be changed"
        };
    }

    if (member.role === role) {
        return { status: 400, message: "Member already has the " + role + " role" };
    }

    return null;
};

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

            // Role changes run through the same guards as PATCH /:memberId/role
            // so this endpoint cannot be used to sidestep them.
            if (role) {
                const problem = roleChangeProblem(req, member, role);
                if (problem) {
                    return res.status(problem.status).json({
                        success: false,
                        message: problem.message
                    });
                }
                member.role = role;
            }
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

            // A suspended member coming back is a *re*-activation; an invited
            // one is joining for the first time. The email says which.
            const wasSuspended = member.status === "SUSPENDED";

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
                    subject: wasSuspended
                        ? `Your account has been reinstated at ${organization?.name || 'the organization'}`
                        : `Your account is now active in ${organization?.name || 'the organization'}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #F47C3C;">${wasSuspended ? "Account Reinstated!" : "Account Activated!"}</h2>
                            <p>Your account has been ${wasSuspended ? "reinstated" : "activated"} for <strong>${organization?.name || 'the organization'}</strong>.</p>
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
                message: wasSuspended
                    ? "Member reactivated successfully"
                    : "Member activated successfully",
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

            // Suspension cuts off their access immediately (see `protect`), so
            // they find out the moment they try to use the app — tell them why
            // rather than leaving them staring at a login screen.
            const organization = await Organization.findById(member.organizationId);
            const email = member.userId?.email;

            if (email) {
                try {
                    await sendEmail({
                        email,
                        subject: `Your access to ${organization?.name || 'the organization'} has been suspended`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                                <h2 style="color: #F47C3C;">Account Suspended</h2>
                                <p>Your <strong>${member.role}</strong> access to <strong>${organization?.name || 'the organization'}</strong> has been suspended.</p>
                                <p>You have been signed out and won't be able to log in until an administrator reinstates your account.</p>
                                <p style="color: #666;">If you think this is a mistake, please contact your organization administrator.</p>
                                <p style="font-size: 12px; color: #999; margin-top: 30px;">This is an automated message — please do not reply.</p>
                            </div>
                        `
                    });
                } catch (mailError) {
                    // The suspension is already saved — a bounced notification
                    // must not turn a successful action into a 500.
                    console.error("Suspension email failed:", mailError);
                }
            }

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

    // 6. Change a member's role (AGENT <-> MANAGER <-> FINANCE)
    changeRole: async (req, res) => {
        try {
            if (!canManageTeam(req)) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized to manage team members"
                });
            }

            const { memberId } = req.params;
            const { role } = req.body;

            if (!mongoose.isValidObjectId(memberId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid member id"
                });
            }

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

            const problem = roleChangeProblem(req, member, role);
            if (problem) {
                return res.status(problem.status).json({
                    success: false,
                    message: problem.message
                });
            }

            const previousRole = member.role;
            member.role = role;
            await member.save();

            await member.populate("userId", "email");

            // Tell the member their seat changed — their portal (and so the
            // pages they land on) changes with it, so a silent switch would be
            // confusing.
            const organization = await Organization.findById(member.organizationId);
            const email = member.userId?.email;

            if (email) {
                try {
                    await sendEmail({
                        email,
                        subject: `Your role at ${organization?.name || 'the organization'} is now ${role}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                                <h2 style="color: #F47C3C;">Your role has changed</h2>
                                <p>Your role at <strong>${organization?.name || 'the organization'}</strong> has been changed from <strong>${previousRole}</strong> to <strong>${role}</strong>.</p>
                                <p>Sign in again to pick up your new permissions.</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${env.clientUrl}/login"
                                       style="background: #F47C3C; color: white; padding: 12px 40px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                        Login Now
                                    </a>
                                </div>
                            </div>
                        `
                    });
                } catch (mailError) {
                    // The role change is already saved — a bounced notification
                    // must not turn a successful update into a 500.
                    console.error("Role change email failed:", mailError);
                }
            }

            res.status(200).json({
                success: true,
                message: `Role updated from ${previousRole} to ${role}`,
                data: member
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // 7. Delete member
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

    // 8. Get my organization info
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