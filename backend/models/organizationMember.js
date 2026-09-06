import mongoose from "mongoose";

const organizationMemberSchema = new mongoose.Schema(
{
    organizationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Organization",
        required:true,
        index:true
    },

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    // OWNER is the single seat that owns the organization and can never be
    // reassigned from a role dropdown. ADMIN is the promotable equivalent: it
    // grants the same admin portal and team-management rights, so an owner can
    // have several admins without giving away the organization itself.
    // MUST stay in sync with ORG_ROLES in
    // backend/controllers/member.controller.js and ROLE_META in
    // frontend/src/app/admin/users/page.js.
    role:{
        type:String,
        enum:[
            "OWNER",
            "ADMIN",
            "MANAGER",
            "AGENT",
            "FINANCE",
            "OPERATION"
        ],
        default:"AGENT"
    },

    status:{
        type:String,
        enum:[
            "INVITED",
            "ACTIVE",
            "SUSPENDED"
        ],
        default:"INVITED"
    },

    permissions:[
        String
    ]

},
{
    timestamps:true
});

export default mongoose.model("OrganizationMember", organizationMemberSchema);