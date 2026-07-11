import mongoose from "mongoose";

const welcomePackSchema = new mongoose.Schema(
  {
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

    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },

    wifiNetwork: String,
    wifiPassword: String,
    emergencyNumber: String,
    videoUrl: String,

    documentUrl: String,      // Only URL stored (frontend uploads file)
    documentName: String,

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
welcomePackSchema.index({ organizationId: 1, propertyId: 1, isDeleted: 1 });
welcomePackSchema.index({ propertyId: 1, isDeleted: 1 });

export default mongoose.model("WelcomePack", welcomePackSchema);