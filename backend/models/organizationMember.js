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

    role:{
        type:String,
        enum:[
            "OWNER",
            "MANAGER",
            "AGENT",
            "FINANCE"
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