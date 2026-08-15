import WelcomePack from "../models/WelcomePack.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";

// GET the signed-in TENANT's welcome pack(s) — scoped to THEIR property, and
// further to property-wide packs plus any pack targeted at THEIR specific room.
export const getMyWelcomePack = async (req, res) => {
  try {
    const { property, roomId } = await resolveTenantProperty(req.user);

    if (!property?._id) {
      return res.json({ success: true, data: [] });
    }

    const query = {
      organizationId: property.organizationId,
      propertyId: property._id,
      isDeleted: false,
    };

    // Property-wide packs (no room) always apply; room-specific packs apply only
    // when they match the tenant's own room. When the room can't be resolved at
    // all we don't narrow by room — a tenancy with no room link would otherwise
    // see nothing at all in a property whose packs are all room-targeted.
    if (roomId) {
      query.$or = [
        { roomId: null },
        { roomId: { $exists: false } },
        { roomId },
      ];
    }

    const items = await WelcomePack.find(query)
      .populate("propertyId", "name")
      .populate("roomId", "roomName title roomNumber")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    console.error("Get My Welcome Pack Error:", err);
    res.status(500).json({ success: false, message: "Failed to load your welcome pack." });
  }
};

export const getWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const items = await WelcomePack.find({
      organizationId,
      isDeleted: false,
    })
      .populate("propertyId", "name")
      .populate("roomId", "roomName title roomNumber");

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { propertyId, roomId, title, description, wifiNetwork, wifiPassword, emergencyNumber, videoUrl, documentUrl, documentName } = req.body;

    const item = await WelcomePack.create({
      organizationId,
      propertyId,
      roomId: roomId || null, // optional — empty selection means property-wide
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

    // Normalise an empty room selection to null (property-wide) so Mongoose
    // doesn't try to cast "" to an ObjectId.
    const updates = { ...req.body };
    if ("roomId" in updates && !updates.roomId) updates.roomId = null;

    const item = await WelcomePack.findOneAndUpdate(
      { _id: id, organizationId, isDeleted: false },
      updates,
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