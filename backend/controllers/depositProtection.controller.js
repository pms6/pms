import DepositProtection, { DEPOSIT_PROTECTION_STATUSES } from "../models/DepositProtection.js";

const scope = (req) => ({ organizationId: req.user.organizationId });

export const listDepositProtection = async (req, res) => {
  try {
    const rows = await DepositProtection.find(scope(req)).sort({ updatedAt: -1, tenant: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

export const createDepositProtection = async (req, res) => {
  try {
    const tenant = String(req.body.tenant || "").trim();
    if (!tenant) return res.status(400).json({ success: false, message: "Tenant name is required." });
    const status = req.body.status || "Protection Pending";
    if (!DEPOSIT_PROTECTION_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
    const body = { ...req.body, tenant, status };
    ["propertyId", "roomId"].forEach((key) => { if (body[key] === "") body[key] = null; });
    const row = await DepositProtection.create({ ...body, ...scope(req), createdBy: req.user._id });
    res.status(201).json({ success: true, data: row });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

export const updateDepositProtection = async (req, res) => {
  try {
    const body = { ...req.body };
    ["propertyId", "roomId"].forEach((key) => { if (body[key] === "") body[key] = null; });
    if (body.tenant !== undefined) body.tenant = String(body.tenant).trim();
    if (body.status !== undefined && !DEPOSIT_PROTECTION_STATUSES.includes(body.status)) return res.status(400).json({ success: false, message: "Invalid status." });
    if (body.tenant === "") return res.status(400).json({ success: false, message: "Tenant name is required." });
    const row = await DepositProtection.findOneAndUpdate({ _id: req.params.id, ...scope(req) }, body, { new: true, runValidators: true });
    if (!row) return res.status(404).json({ success: false, message: "Deposit protection record not found." });
    res.json({ success: true, data: row });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

export const deleteDepositProtection = async (req, res) => {
  try {
    const row = await DepositProtection.findOneAndDelete({ _id: req.params.id, ...scope(req) });
    if (!row) return res.status(404).json({ success: false, message: "Deposit protection record not found." });
    res.json({ success: true });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};
