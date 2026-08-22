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

    // Optional room targeting. When null the pack applies to the whole property;
    // when set it applies only to tenants of that specific room.
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
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

    // ============================
    // Visibility window
    //
    // How long this card is shown in the tenant hub. Both ends are optional:
    // visibleFrom null = live immediately, visibleUntil null = never expires.
    //
    // Stored as absolute dates rather than a length in days, so every tenant of
    // the property sees the same window. The duration picker in the admin modal
    // is only a shortcut that fills visibleUntil in — nothing reads it back, so
    // there is no second copy of the same fact to drift out of step.
    //
    // Both ends are treated inclusively at day granularity by the query in
    // welcomePack.controller.js: a card whose window ends today is still
    // visible for the whole of today.
    // ============================
    visibleFrom: {
      type: Date,
      default: null,
    },
    visibleUntil: {
      type: Date,
      default: null,
    },

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
welcomePackSchema.index({ propertyId: 1, isDeleted: 1, visibleFrom: 1, visibleUntil: 1 });

export default mongoose.model("WelcomePack", welcomePackSchema);