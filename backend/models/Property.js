import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
{
    organizationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Organization",
        required:true,
        index:true
    },

    createdBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    propertyCode:{
        type:String,
        unique:true,
        index:true
    },

    name:{
        type:String,
        required:true,
        index:true
    },

    rentalType:{
        type:String,
        enum:[
            "HMO",
            "SINGLE_LET",
            "SHORT_TERM",
            "BLOCK"
        ],
        required:true
    },

    tenantType:{
        type:String,
        enum:[
            "ANY",
            "PROFESSIONAL",
            "STUDENT",
            "SOCIAL"
        ],
        default:"ANY"
    },

    ownerName:String,

    // Structured link to the Owner record (in addition to the denormalised
    // ownerName above). Set automatically when an owner is chosen/created.
    ownerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Owner",
        default:null,
        index:true
    },

    address:{
        line1:String,
        line2:String,
        city:String,
        county:String,
        postcode:String,
        country:String
    },

    location:{
        lat:Number,
        lng:Number
    },

    description:String,

    coverImage:String,

    gallery:[
        String
    ],

    status: {
        type: String,
        enum: [
            "ACTIVE",
            "ARCHIVED",
            "DRAFT"
        ],
        default: "ACTIVE"
    },

    isDeleted: {
        type: Boolean,
        default: false
    },

    deletedAt: Date,

},
{
    timestamps:true
});

export default mongoose.model("Property",propertySchema);