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

    securityDeposit: Number,

    holdingDeposit: Number,

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