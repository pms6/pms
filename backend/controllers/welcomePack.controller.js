import WelcomePack from "../models/WelcomePack.js";

export const getWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const items = await WelcomePack.find({
      organizationId,
      isDeleted: false,
    }).populate("propertyId", "name");

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { propertyId, title, description, wifiNetwork, wifiPassword, emergencyNumber, videoUrl, documentUrl, documentName } = req.body;

    const item = await WelcomePack.create({
      organizationId,
      propertyId,
      title,
      description,
      wifiNetwork,
      wifiPassword,
      emergencyNumber,
      videoUrl,
      documentUrl,
      documentName,
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const item = await WelcomePack.findOneAndUpdate(
      { _id: id, organizationId, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Welcome pack not found" });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const item = await WelcomePack.findOneAndUpdate(
      { _id: id, organizationId },
      { isDeleted: true },
      { new: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};