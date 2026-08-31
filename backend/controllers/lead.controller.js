// controllers/lead.controller.js
import Lead from "../models/Lead.js";

const LEAD_STAGES = ["pending", "new", "qualified", "viewing", "converted", "lost"];

// The intake column. Every lead is created here and needs an approval to leave.
const PENDING = "pending";

// Where Approve sends a lead — the first working column of the pipeline.
const APPROVED_STAGE = "new";

/**
 * Stamp the approving member onto a lead.
 *
 * Any staff seat may approve (OWNER, MANAGER, AGENT and FINANCE all reach this
 * — the route is `staffOnly`), so this records who did it rather than deciding
 * whether they may. Re-approving an already-approved lead is a no-op: the first
 * sign-off is the one that counts, and a later drag between columns must not
 * rewrite it.
 */
const stampApproval = (lead, req) => {
  if (lead.approvedAt) return;

  lead.approvedBy = req.user._id;
  lead.approvedByEmail = req.user.email || "";
  lead.approvedByRole = req.user.organizationRole || "";
  lead.approvedAt = new Date();
};

// ---------------------------------------------------------------------------
// Applicant screening answers
//
// The same normalisation the public enquiry form uses (public.controller.js),
// so a lead typed in on the Leads board and one that arrives from the website
// store identical values rather than "yes" in one place and "Yes" in another.
// ---------------------------------------------------------------------------

const oneOf = (value, allowed) => {
  const clean = String(value ?? "").trim();
  return allowed.find((a) => a.toLowerCase() === clean.toLowerCase()) || "";
};

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

const text = (value) => String(value ?? "").trim();

/** Normalise an incoming `applicant` object. Unknown enum values become "". */
const buildApplicant = (raw = {}) => ({
  age: positiveInt(raw.age),
  gender: text(raw.gender),
  maritalStatus: oneOf(raw.maritalStatus, ["Single", "Married"]),
  smoking: oneOf(raw.smoking, ["Yes", "No"]),
  occupancy: oneOf(raw.occupancy, ["Single", "Couple"]),
  workStatus: oneOf(raw.workStatus, ["Working", "Student"]),
  rentPayment: text(raw.rentPayment),
  minimumStayMonths: positiveInt(raw.minimumStayMonths),
  nationality: text(raw.nationality),
  passportCountry: text(raw.passportCountry),
  moveInDate: text(raw.moveInDate),
  pet: oneOf(raw.pet, ["Yes", "No"]),
});

// Every answer the Leads board form asks for, in the order it asks. Website
// enquiries go through public.controller.js and are NOT held to this list.
const REQUIRED_APPLICANT_FIELDS = [
  ["age", "Age"],
  ["gender", "Gender"],
  ["maritalStatus", "Marital status"],
  ["pet", "Pet"],
  ["smoking", "Smoking"],
  ["passportCountry", "Passport country"],
  ["minimumStayMonths", "Minimum stay"],
  ["moveInDate", "Move-in date"],
  ["workStatus", "Work status"],
  ["rentPayment", "How the rent will be paid"],
];

/**
 * The first missing answer, as a human label — or null when all are present.
 * A rejected enum value normalises to "" and so reads as missing, which is what
 * we want: "Marital status is required" beats silently storing nothing.
 */
const missingApplicantField = (applicant) => {
  for (const [key, label] of REQUIRED_APPLICANT_FIELDS) {
    const value = applicant[key];
    if (value === null || value === undefined || value === "") return label;
  }
  return null;
};

/**
 * Create Lead
 */
export const createLead = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const {
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId,
      roomId,
      budget,
      assignedTo,
      notes,
    } = req.body;

    // The Leads board form asks for all of these, so a request missing one is
    // a client that has drifted from the form rather than an operator choice.
    // Website enquiries take a different path (public.controller.js) and are
    // deliberately not held to it.
    const required = [
      [name, "Lead name"],
      [email, "Email"],
      [phone, "Phone"],
    ];

    for (const [value, label] of required) {
      if (!String(value ?? "").trim()) {
        return res.status(400).json({
          success: false,
          message: `${label} is required.`,
        });
      }
    }

    const budgetValue = Number(budget);
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Budget is required.",
      });
    }

    const applicant = buildApplicant(req.body.applicant);
    const missing = missingApplicantField(applicant);
    if (missing) {
      return res.status(400).json({
        success: false,
        message: `${missing} is required.`,
      });
    }

    const lead = await Lead.create({
      organizationId,
      createdBy,
      // Everything reaching this handler is a staff member — the route is
      // staffOnly — so the board can name them as the one who added the lead.
      createdByEmail: req.user.email || "",
      createdByRole: req.user.organizationRole || "",
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId: propertyId || null,
      roomId: roomId || null,
      budget: budgetValue,
      applicant,
      assignedTo,
      // Every lead starts in the intake column, whatever the client asked for.
      // Nothing reaches the working pipeline without an explicit approval, so
      // there is no stage to choose at creation and no lost reason to record.
      status: PENDING,
      notes,
      lostReason: "",
      lostAt: null,
    });

    // Populate references before sending response
    const populatedLead = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber type")
      .populate("createdBy", "email");

    return res.status(201).json({
      success: true,
      message: "Lead created successfully.",
      data: populatedLead,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create lead.",
    });
  }
};

/**
 * Get Leads (optionally filtered by status / search)
 */
export const getLeads = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status, source, search = "" } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (status) filter.status = status;
    if (source) filter.source = source;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { interestedIn: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(filter)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .populate("createdBy", "email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: leads.length,
      data: leads,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leads.",
    });
  }
};

/**
 * Get Single Lead by ID
 */
export const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    })
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .populate("createdBy", "email")
      .lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead.",
    });
  }
};

/**
 * Update Lead
 */
export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    const {
      name,
      email,
      phone,
      source,
      interestedIn,
      propertyId,
      roomId,
      budget,
      assignedTo,
      status,
      notes,
    } = req.body;

    if (name !== undefined) lead.name = name;
    if (email !== undefined) lead.email = email;
    if (phone !== undefined) lead.phone = phone;
    if (source !== undefined) lead.source = source;
    if (interestedIn !== undefined) lead.interestedIn = interestedIn;
    if (propertyId !== undefined) lead.propertyId = propertyId || null;
    if (roomId !== undefined) lead.roomId = roomId || null;
    if (budget !== undefined) lead.budget = Number(budget) || 0;
    if (assignedTo !== undefined) lead.assignedTo = assignedTo;
    if (notes !== undefined) lead.notes = notes;

    // Screening answers are MERGED over whatever the lead already has, and are
    // not required here. A website lead predates the board's questions and a
    // partial edit (say, moving it to a different room) must not blank the
    // answers the applicant did give. The board's form sends the full set.
    if (req.body.applicant !== undefined) {
      const incoming = buildApplicant(req.body.applicant);
      const current = lead.applicant?.toObject?.() ?? lead.applicant ?? {};

      for (const [key, value] of Object.entries(incoming)) {
        const given = value !== null && value !== undefined && value !== "";
        if (given || current[key] === undefined) lead.applicant[key] = value;
      }
    }

    // Keep the lost reason in step with the stage, the same way the Kanban
    // status endpoint does.
    if (status !== undefined) {
      lead.status = status;

      if (status === "lost") {
        const reason = String(req.body.lostReason ?? lead.lostReason ?? "").trim();
        if (!reason) {
          return res.status(400).json({
            success: false,
            message: "A reason is required when marking a lead as lost.",
          });
        }
        lead.lostReason = reason;
        lead.lostAt = lead.lostAt || new Date();
      } else {
        lead.lostReason = "";
        lead.lostAt = null;
      }
    }

    await lead.save();

    // Return populated document
    const updatedLead = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .populate("createdBy", "email")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully.",
      data: updatedLead,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update lead.",
    });
  }
};

/**
 * Approve Lead — the Approve button on a card in the "pending" column.
 *
 * Moves the lead into the first working stage and records who signed it off.
 * Any staff seat may do this (the route is `staffOnly`); the point of the
 * record is that the rest of the team can see who did, not to stop anyone.
 */
export const approveLead = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({ _id: id, organizationId, isDeleted: false });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    if (lead.status !== PENDING) {
      return res.status(400).json({
        success: false,
        message: "Only a pending lead can be approved.",
      });
    }

    stampApproval(lead, req);
    lead.status = APPROVED_STAGE;
    lead.lostReason = "";
    lead.lostAt = null;

    await lead.save();

    const approved = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .populate("createdBy", "email");

    return res.status(200).json({
      success: true,
      message: "Lead approved.",
      data: approved,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve lead.",
    });
  }
};

/**
 * Update Lead Status (drag between Kanban columns)
 */
export const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, lostReason } = req.body;
    const organizationId = req.user.organizationId;

    if (!status || !LEAD_STAGES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${LEAD_STAGES.join(", ")}.`,
      });
    }

    // Losing a lead has to say why. Moving back out of "lost" clears the reason
    // so a live lead never carries a stale one.
    const reason = String(lostReason ?? "").trim();

    if (status === "lost" && !reason) {
      return res.status(400).json({
        success: false,
        message: "A reason is required when marking a lead as lost.",
      });
    }

    const lead = await Lead.findOne({ _id: id, organizationId, isDeleted: false });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    // Dragging a card out of "pending" IS an approval — the board offers both
    // the button and the drag, and a lead that reached the working pipeline
    // without an approver on it would leave a gap in the trail. Moving it
    // straight to "lost" is a rejection, so that one records no approver.
    if (lead.status === PENDING && status !== PENDING && status !== "lost") {
      stampApproval(lead, req);
    }

    lead.status = status;
    lead.lostReason = status === "lost" ? reason : "";
    lead.lostAt = status === "lost" ? new Date() : null;

    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate("propertyId", "name")
      .populate("roomId", "name roomNumber")
      .populate("createdBy", "email");

    return res.status(200).json({
      success: true,
      message: "Lead status updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update lead status.",
    });
  }
};

/**
 * Delete Lead (soft delete)
 */
export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const lead = await Lead.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found.",
      });
    }

    lead.isDeleted = true;
    lead.deletedAt = new Date();
    await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete lead.",
    });
  }
};

/**
 * Lead Statistics (counts per stage)
 */
export const getLeadStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const counts = await Promise.all(
      LEAD_STAGES.map((stage) =>
        Lead.countDocuments({ organizationId, isDeleted: false, status: stage })
      )
    );

    const byStage = LEAD_STAGES.reduce((acc, stage, i) => {
      acc[stage] = counts[i];
      return acc;
    }, {});

    const total = counts.reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      data: { total, byStage },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead statistics.",
    });
  }
};