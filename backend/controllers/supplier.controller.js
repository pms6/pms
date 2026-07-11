// controllers/supplier.controller.js
import Supplier from "../models/Supplier.js";

/**
 * Whitelist of fields a client may set on create/update.
 */
const EDITABLE_KEYS = [
  "company",
  "contactForename",
  "contactSurname",
  "email",
  "phone",
  "preferred",
  "specialisms",
  "tags",
  "documents",
  "permissions",
  "notes",
  "unpaidInvoices",
  "archived",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// @desc    List suppliers (with optional filters)
// @route   GET /api/v1/suppliers
export const getSuppliers = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { specialism, archived, unpaidOnly, search } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (specialism) filter.specialisms = specialism;
    if (archived !== undefined) filter.archived = archived === "true";
    if (unpaidOnly === "true") filter.unpaidInvoices = { $gt: 0 };

    if (search) {
      const rx = { $regex: search, $options: "i" };
      filter.$or = [
        { company: rx },
        { email: rx },
        { contactForename: rx },
        { contactSurname: rx },
      ];
    }

    const suppliers = await Supplier.find(filter).sort({ preferred: -1, company: 1 });

    return res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    console.error("Get Suppliers Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch suppliers." });
  }
};

// @desc    Get a single supplier
// @route   GET /api/v1/suppliers/:id
export const getSupplierById = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    return res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    console.error("Get Supplier Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch supplier." });
  }
};

// @desc    Create a supplier
// @route   POST /api/v1/suppliers
export const createSupplier = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const payload = pickPayload(req.body);

    if (!payload.company || !String(payload.company).trim()) {
      return res.status(400).json({ success: false, message: "Company name is required." });
    }

    const supplier = await Supplier.create({ ...payload, organizationId, createdBy });

    return res.status(201).json({
      success: true,
      message: "Supplier created.",
      data: supplier,
    });
  } catch (error) {
    console.error("Create Supplier Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create supplier." });
  }
};

// @desc    Update a supplier
// @route   PUT /api/v1/suppliers/:id
export const updateSupplier = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    Object.assign(supplier, pickPayload(req.body));
    const updated = await supplier.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Supplier Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update supplier." });
  }
};

// @desc    Toggle a supplier's archived state
// @route   PATCH /api/v1/suppliers/:id/archive
export const toggleSupplierArchive = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    // Explicit target if provided, otherwise flip current state.
    supplier.archived =
      typeof req.body?.archived === "boolean" ? req.body.archived : !supplier.archived;
    const updated = await supplier.save();

    return res.status(200).json({
      success: true,
      message: updated.archived ? "Supplier archived." : "Supplier restored.",
      data: updated,
    });
  } catch (error) {
    console.error("Archive Supplier Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update supplier." });
  }
};

// @desc    Soft delete a supplier
// @route   DELETE /api/v1/suppliers/:id
export const deleteSupplier = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const supplier = await Supplier.findOne({ _id: req.params.id, organizationId });
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    supplier.isDeleted = true;
    supplier.deletedAt = new Date();
    await supplier.save();

    return res.status(200).json({ success: true, message: "Supplier deleted." });
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete supplier." });
  }
};
