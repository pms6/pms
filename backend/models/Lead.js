import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Who added this lead, denormalized at creation the same way Task stores
    // createdByEmail. Kept alongside the ref so the board can name the member
    // without a populate, and so the attribution survives them leaving the team.
    createdByEmail: {
      type: String,
      trim: true,
      default: "",
    },

    // The creator's organization role ("OWNER" / "MANAGER" / "AGENT" /
    // "FINANCE"). Empty means it was NOT a team member: website enquiries are
    // created by the enquirer's own account, and naming them as the member who
    // added the lead would be wrong.
    createdByRole: {
      type: String,
      trim: true,
      default: "",
    },

    // ============================
    // Lead Details
    // ============================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: ["Rightmove", "Zoopla", "SpareRoom", "OpenRent", "Website", "Referral"],
      default: "Website",
    },

    interestedIn: {
      type: String,
      trim: true,
    },

    // Structured link to what the lead enquired about (set by website
    // enquiries). Used to dedupe a tenant's repeat requests for the same room.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },

    budget: {
      type: Number,
      default: 0,
    },
    // ============================
    // Applicant details
    // ============================
    // Screening answers. Collected on the website request form AND on the
    // Leads board's own form, which requires them.
    //
    // Everything stays optional at the SCHEMA level: leads created before these
    // questions existed carry none of them, and requiring them here would make
    // those records unsaveable on any later edit. The Leads board form and
    // createLead enforce the requirement for new leads instead.
    applicant: {
      age: { type: Number, default: null },
      gender: { type: String, trim: true, default: "" },

      // Marital status is a different question from `occupancy` below: a
      // married applicant may still be taking the room alone.
      maritalStatus: { type: String, enum: ["", "Single", "Married"], default: "" },

      smoking: { type: String, enum: ["", "Yes", "No"], default: "" },
      occupancy: { type: String, enum: ["", "Single", "Couple"], default: "" },
      workStatus: { type: String, enum: ["", "Working", "Student"], default: "" },

      // How the applicant intends to pay the rent — salary, student loan,
      // guarantor, savings. Free text, asked of students and workers alike.
      rentPayment: { type: String, trim: true, default: "" },

      minimumStayMonths: { type: Number, default: null },
      nationality: { type: String, trim: true, default: "" },

      // The country that issued the applicant's passport. Kept separate from
      // `nationality` because a right-to-rent check records the document's
      // issuing country, which a dual national's stated nationality may not
      // match. The website form asks only for nationality; the Leads board
      // form asks only for the passport country.
      passportCountry: { type: String, trim: true, default: "" },

      moveInDate: { type: String, default: "" }, // YYYY-MM-DD
      pet: { type: String, enum: ["", "Yes", "No"], default: "" },
    },

    assignedTo: {
      type: String,
      trim: true,
    },

    // Pipeline stage — matches the frontend Kanban columns.
    //
    // "pending" is the intake column: EVERY lead starts there, whether it was
    // typed in on the board or arrived from the website, and only leaves once a
    // staff member approves it. It is first in the list so the board and the
    // stats endpoint both render the pipeline in order.
    status: {
      type: String,
      enum: ["pending", "new", "qualified", "viewing", "converted", "lost"],
      default: "pending",
    },

    // ============================
    // Approval
    // ============================
    // Who moved this lead out of "pending". Any staff seat may approve — the
    // record is an audit trail, not a permission gate — so the whole team can
    // see which colleague signed a lead off.
    //
    // Denormalised the same way createdByEmail / createdByRole are: the ref
    // alone would need a populate on every read, and the attribution has to
    // survive that member leaving the team.
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedByEmail: {
      type: String,
      trim: true,
      default: "",
    },

    approvedByRole: {
      type: String,
      trim: true,
      default: "",
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    notes: String,

    // Why the lead was lost. Captured when it moves into the "lost" stage and
    // cleared if it moves back out, so a live lead never carries a stale reason.
    lostReason: {
      type: String,
      trim: true,
      default: "",
    },

    lostAt: {
      type: Date,
      default: null,
    },

    // ============================
    // Soft delete
    // ============================
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Lead", leadSchema);
