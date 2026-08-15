import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS Relationships
    // ============================

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    currentTenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },

    // ============================
    // Basic Information
    // ============================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    roomName: {
      type: String,
      required: true,
    },

    roomNumber: String,

    roomLabel: String,

    description: String,

    // ============================
    // Room Type
    // ============================

    roomType: {
      type: String,
      enum: [
        "STANDARD",
        "ENSUITE",
        "STUDIO",
        "MASTER",
        "DOUBLE",
        "SINGLE",
      ],
      default: "STANDARD",
    },

    occupancy: {
      type: String,
      enum: ["SINGLE", "DOUBLE", "TWIN", "FAMILY"],
      default: "SINGLE",
    },

    furnished: {
      type: Boolean,
      default: true,
    },

    floor: String,

    roomSize: String,

    bathroomType: {
      type: String,
      enum: ["private", "shared"],
      default: "shared",
    },

    // ============================
    // Pricing
    // ============================

    monthlyRent: {
      type: Number,
      required: true,
    },

    // Whether monthlyRent is advertised per calendar month or per week.
    // The stored figure is always the one the landlord typed for that period.
    rentPeriod: {
      type: String,
      enum: ["MONTHLY", "WEEKLY"],
      default: "MONTHLY",
    },

    securityDeposit: Number,

    holdingDeposit: Number,

    // Headline answer to "Bills included?". SOME means defer to the individual
    // flags in billsIncluded below; YES/NO set them all one way.
    billsOption: {
      type: String,
      enum: ["YES", "NO", "SOME"],
      default: "SOME",
    },

    billsIncluded: {
      electricity: {
        type: Boolean,
        default: true,
      },
      gas: {
        type: Boolean,
        default: true,
      },
      water: {
        type: Boolean,
        default: true,
      },
      wifi: {
        type: Boolean,
        default: true,
      },
      internet: {
        type: Boolean,
        default: true,
      },
      councilTax: {
        type: Boolean,
        default: false,
      },
    },

    // ============================
    // Availability
    // ============================

    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "AVAILABLE_SOON",
        "RESERVED",
        "OCCUPIED",
        "MAINTENANCE",
      ],
      default: "AVAILABLE",
    },

    availableImmediately: {
      type: Boolean,
      default: false,
    },

    availableFrom: Date,

    minimumTenancy: {
      type: Number,
      default: 6,
    },

    maximumTenancy: Number,

    // Short term lets considered (roughly 1 week to 3 months).
    shortTermLets: {
      type: Boolean,
      default: false,
    },

    daysAvailable: {
      type: String,
      enum: ["SEVEN_DAYS", "WEEKDAYS", "WEEKENDS"],
      default: "SEVEN_DAYS",
    },

    // null = not answered.
    referencesRequired: {
      type: Boolean,
      default: null,
    },

    // ============================
    // Amenities
    // ============================

    roomAmenities: [
      {
        type: String,
        enum: [
          "single_bed",
          "double_bed",
          "desk",
          "chair",
          "wardrobe",
          "tv",
          "balcony",
          "ensuite_bathroom",
          "lockable_room",
          "chest_of_drawers",
          "mirror",
        ],
      },
    ],

    propertyAmenities: [
      {
        type: String,
        enum: [
          "wifi",
          "washing_machine",
          "dryer",
          "dishwasher",
          "shared_kitchen",
          "parking",
          "garden",
          "lift",
          "gym",
          "security",
          "cctv",
          "cleaning_service",
          "bike_storage",
        ],
      },
    ],

    wifiSpeed: String,

    // ============================
    // Images
    // ============================

    images: [
      {
        url: String,
        alt: String,
      },
    ],

    // ============================
    // Public Listing
    // ============================

    featured: {
      type: Boolean,
      default: false,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },

    slug: {
      type: String,
      unique: true,
    },

    listingCode: {
      type: String,
      unique: true,
    },

    // ============================
    // Preferences for new flatmate
    //
    // Advertised preferences only. Note that some of these (notably gender)
    // cannot lawfully be used to discriminate by a live-out landlord.
    // ============================

    preferences: {
      smoking: {
        type: String,
        enum: ["NO_PREFERENCE", "YES", "NO"],
        default: "NO_PREFERENCE",
      },
      gender: {
        type: String,
        enum: ["ANY", "MALE", "FEMALE"],
        default: "ANY",
      },
      occupation: {
        type: String,
        enum: ["STUDENTS_ONLY", "NO_STUDENTS", "ALL"],
        default: "ALL",
      },
      pets: {
        type: String,
        enum: ["NO_PREFERENCE", "YES", "NO"],
        default: "NO",
      },
      minAge: Number,
      maxAge: Number,
      language: String,
      couplesWelcome: {
        type: Boolean,
        default: false,
      },
      vegetarianPreferred: {
        type: Boolean,
        default: false,
      },
    },

    // ============================
    // Inventory
    //
    // Schedule of condition for this room. The property's own inventory covers
    // shared and communal items.
    // ============================

    inventory: {
      checkedOn: Date,
      checkedBy: String,
      items: [
        {
          item: String,
          location: String,
          quantity: {
            type: Number,
            default: 1,
            min: 0,
          },
          condition: {
            type: String,
            enum: ["NEW", "GOOD", "FAIR", "POOR"],
            default: "GOOD",
          },
          // Replacement value per unit, used for check-out deductions.
          price: Number,
          notes: String,
        },
      ],
    },

    // ============================
    // Internal
    // ============================

    notes: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Room", roomSchema);