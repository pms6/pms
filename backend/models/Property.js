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
        area:String,
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

    // ============================
    // More about the property
    // ============================

    // Nearest transport link, e.g. "0-5 minutes walk from Green Park".
    transport:{
        minutes:{
            type:String,
            enum:[
                "0-5",
                "5-10",
                "10-15",
                "15-20",
                "20-30",
                "30+"
            ]
        },
        mode:{
            type:String,
            enum:[
                "walk",
                "bus",
                "train",
                "tube",
                "tram"
            ],
            default:"walk"
        },
        station:String
    },

    // true = there is a shared living room. null/undefined = not answered.
    livingRoom:{
        type:Boolean,
        default:null
    },

    amenities:[
        {
            type:String,
            enum:[
                "parking",
                "garden_patio",
                "garage",
                "balcony_terrace",
                "disabled_access"
            ]
        }
    ],

    // ============================
    // Contract
    //
    // The tenancy agreement between landlord and tenant for the property as a
    // whole. Meaningful for SINGLE_LET / SHORT_TERM / BLOCK lets; an HMO is let
    // room by room, so those agreements belong on the individual tenancies.
    // ============================

    contract:{
        agreementType:{
            type:String,
            enum:[
                "AST",
                "COMPANY_LET",
                "LICENCE",
                "LODGER",
                "OTHER"
            ],
            default:"AST"
        },
        startDate:Date,
        endDate:Date,
        rentAmount:Number,
        rentPeriod:{
            type:String,
            enum:["MONTHLY","WEEKLY"],
            default:"MONTHLY"
        },
        // Notice either side must give, in months.
        noticeMonths:{
            type:Number,
            default:1
        },
        depositScheme:{
            type:String,
            enum:[
                "NONE",
                "DPS",
                "MYDEPOSITS",
                "TDS"
            ],
            default:"NONE"
        },
        depositAmount:Number,
        landlordName:String,
        tenantName:String,
        // Whether the fixed term rolls into a periodic tenancy at the end.
        rollsToPeriodic:{
            type:Boolean,
            default:true
        },
        notes:String,

        // ----------------------------
        // Expiry reminder
        // ----------------------------
        // Mirrors the Compliance model's reminder settings, driven off endDate.
        // Note there is deliberately NO stored status field here: Compliance
        // computes its status in a pre-save hook, so it goes stale the moment
        // a record sits untouched past its expiry. Contract expiry is derived
        // from endDate on read instead.
        autoReminder:{
            type:Boolean,
            default:true
        },
        reminderDaysBefore:{
            type:Number,
            default:30,
            min:1,
            max:365
        },
        // Set when a reminder goes out, so the daily job emails once per
        // reminder window rather than every morning until the contract ends.
        lastReminderSentAt:{
            type:Date,
            default:null
        }
    },

    // ============================
    // Inventory
    //
    // Schedule of condition — what is in the property and what state it is in
    // at check-in, so it can be compared at check-out.
    // ============================

    inventory:{
        checkedOn:Date,
        checkedBy:String,
        items:[
            {
                item:String,
                location:String,
                quantity:{
                    type:Number,
                    default:1,
                    min:0
                },
                condition:{
                    type:String,
                    enum:[
                        "NEW",
                        "GOOD",
                        "FAIR",
                        "POOR"
                    ],
                    default:"GOOD"
                },
                // Replacement value per unit, used for check-out deductions.
                price:Number,
                notes:String
            }
        ]
    },

    // ============================
    // Documents
    //
    // Contract and other important files. Compliance certificates (EPC, EICR,
    // Gas Safety, HMO Licence, ...) live on the Compliance model instead, which
    // tracks their expiry and reminders.
    // ============================

    documents:[
        {
            name:String,
            url:String,
            type:{
                type:String,
                enum:[
                    "CONTRACT",
                    "INSURANCE",
                    "INVENTORY",
                    "FLOOR_PLAN",
                    "LICENCE",
                    "OTHER"
                ],
                default:"OTHER"
            },
            uploadedAt:{
                type:Date,
                default:Date.now
            }
        }
    ],

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