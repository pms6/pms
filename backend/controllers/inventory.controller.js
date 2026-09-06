// controllers/inventory.controller.js
//
// The inventory (schedule of condition) is stored embedded on each scope —
// Property.inventory.items for shared/communal things, Room.inventory.items for
// a single room. That is the right shape for the property and room forms, but
// it means the office has no way to see the organisation's whole inventory at
// once. These endpoints flatten every scope into one list and let a single item
// be created, edited, moved between scopes and deleted by its own id.
//
// Writes deliberately use a targeted $set / $pull on the inventory path rather
// than loading the document and calling save(). A full save() revalidates the
// entire document, so one legacy field elsewhere on a room (a status value that
// predates the current enum, say) would block every inventory edit on it —
// which is exactly the "cannot save inventory" failure this replaces.

import mongoose from "mongoose";
import Property from "../models/Property.js";
import Room from "../models/Room.js";

export const INVENTORY_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR"];

const PROPERTY_SCOPE = "property";
const ROOM_SCOPE = "room";

const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);

const toNumberOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cleanImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((img) => (typeof img === "string" ? { url: img, publicId: "" } : img))
    .filter((img) => img?.url)
    .map((img) => ({ url: str(img.url, 2000), publicId: str(img.publicId, 200) }));

// One inventory row, as the schema wants it. `_id` is preserved on edit so the
// row keeps its identity.
const cleanItem = (body, existingId) => {
  const quantity = Number(body.quantity);
  return {
    _id: existingId || new mongoose.Types.ObjectId(),
    item: str(body.item, 200),
    location: str(body.location, 200),
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 1,
    condition: INVENTORY_CONDITIONS.includes(body.condition) ? body.condition : "GOOD",
    price: toNumberOrNull(body.price),
    notes: str(body.notes, 2000),
    images: cleanImages(body.images),
  };
};

const modelFor = (scopeType) =>
  scopeType === ROOM_SCOPE ? Room : scopeType === PROPERTY_SCOPE ? Property : null;

// Resolves and authorises the scope an item is being written to.
const findScope = async (scopeType, scopeId, organizationId) => {
  const Model = modelFor(scopeType);
  if (!Model || !mongoose.isValidObjectId(scopeId)) return null;

  const query = { _id: scopeId, organizationId, isDeleted: { $ne: true } };
  const doc = await Model.findOne(query)
    .select("_id name roomName roomNumber title propertyId inventory")
    .lean();

  return doc ? { Model, doc } : null;
};

// Flattens one scope's inventory into standalone rows for the table.
const flatten = ({ scopeType, scopeDoc, propertyName, roomName }) => {
  const inventory = scopeDoc.inventory || {};
  const items = Array.isArray(inventory.items) ? inventory.items : [];

  return items.map((it) => {
    const quantity = Number(it.quantity) || 0;
    const price = it.price == null ? null : Number(it.price);
    return {
      _id: String(it._id),
      scopeType,
      scopeId: String(scopeDoc._id),
      propertyId: String(
        scopeType === ROOM_SCOPE ? scopeDoc.propertyId || "" : scopeDoc._id
      ),
      propertyName: propertyName || "",
      roomId: scopeType === ROOM_SCOPE ? String(scopeDoc._id) : null,
      roomName: roomName || "",
      item: it.item || "",
      location: it.location || "",
      quantity,
      condition: it.condition || "GOOD",
      price,
      notes: it.notes || "",
      images: Array.isArray(it.images) ? it.images : [],
      // The schedule header belongs to the scope, so every row from a scope
      // carries the same check details.
      checkedOn: inventory.checkedOn || null,
      checkedBy: inventory.checkedBy || "",
      value: price == null ? 0 : quantity * price,
    };
  });
};

const roomLabel = (room) =>
  [room.roomNumber, room.roomName, room.title].filter(Boolean).join(" · ") || "Room";

// @desc    Every inventory item in the organisation, property and room alike
// @route   GET /api/v1/inventory
export const getInventory = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { propertyId, condition, scopeType } = req.query;

    const propertyFilter = { organizationId, isDeleted: false };
    if (propertyId && mongoose.isValidObjectId(propertyId)) propertyFilter._id = propertyId;

    const properties = await Property.find(propertyFilter)
      .select("_id name inventory")
      .lean();

    const roomFilter = { organizationId, isDeleted: { $ne: true } };
    if (propertyId && mongoose.isValidObjectId(propertyId)) roomFilter.propertyId = propertyId;

    const rooms = await Room.find(roomFilter)
      .select("_id roomName roomNumber title propertyId inventory")
      .lean();

    const propertyNames = new Map(properties.map((p) => [String(p._id), p.name]));
    // A room can belong to a property outside the filter only when no filter is
    // set, so look up any names still missing in one extra query.
    const missing = [
      ...new Set(
        rooms
          .map((r) => String(r.propertyId || ""))
          .filter((id) => id && !propertyNames.has(id))
      ),
    ];
    if (missing.length) {
      const extra = await Property.find({ _id: { $in: missing }, organizationId })
        .select("_id name")
        .lean();
      for (const p of extra) propertyNames.set(String(p._id), p.name);
    }

    let rows = [];

    if (scopeType !== ROOM_SCOPE) {
      for (const p of properties) {
        rows.push(
          ...flatten({ scopeType: PROPERTY_SCOPE, scopeDoc: p, propertyName: p.name })
        );
      }
    }

    if (scopeType !== PROPERTY_SCOPE) {
      for (const r of rooms) {
        rows.push(
          ...flatten({
            scopeType: ROOM_SCOPE,
            scopeDoc: r,
            propertyName: propertyNames.get(String(r.propertyId || "")) || "",
            roomName: roomLabel(r),
          })
        );
      }
    }

    if (condition) rows = rows.filter((r) => r.condition === condition);

    // Group a property's own items with its rooms', then by item name — the
    // order the office reads the sheet in.
    rows.sort(
      (a, b) =>
        a.propertyName.localeCompare(b.propertyName) ||
        a.roomName.localeCompare(b.roomName) ||
        a.item.localeCompare(b.item)
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Inventory Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch inventory." });
  }
};

// @desc    The scopes an item can be filed against (property + its rooms)
// @route   GET /api/v1/inventory/scopes
export const getInventoryScopes = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const [properties, rooms] = await Promise.all([
      Property.find({ organizationId, isDeleted: false })
        .select("_id name inventory.checkedOn inventory.checkedBy")
        .sort({ name: 1 })
        .lean(),
      Room.find({ organizationId, isDeleted: { $ne: true } })
        .select("_id roomName roomNumber title propertyId")
        .lean(),
    ]);

    const byProperty = new Map(properties.map((p) => [String(p._id), []]));
    for (const r of rooms) {
      const key = String(r.propertyId || "");
      if (byProperty.has(key)) {
        byProperty.get(key).push({ _id: String(r._id), name: roomLabel(r) });
      }
    }

    return res.status(200).json({
      success: true,
      data: properties.map((p) => ({
        _id: String(p._id),
        name: p.name,
        checkedOn: p.inventory?.checkedOn || null,
        checkedBy: p.inventory?.checkedBy || "",
        rooms: byProperty.get(String(p._id)) || [],
      })),
    });
  } catch (error) {
    console.error("Get Inventory Scopes Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load properties and rooms." });
  }
};

// Optional schedule header — only written when the client actually sends it, so
// adding an item never blanks the existing check details.
const checkFields = (body) => {
  const set = {};
  if (body.checkedOn !== undefined) {
    set["inventory.checkedOn"] = body.checkedOn ? new Date(body.checkedOn) : null;
  }
  if (body.checkedBy !== undefined) {
    set["inventory.checkedBy"] = str(body.checkedBy, 120);
  }
  return set;
};

// @desc    Add an inventory item to a property or a room
// @route   POST /api/v1/inventory
export const createInventoryItem = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { scopeType, scopeId } = req.body;

    if (!str(req.body.item)) {
      return res.status(400).json({ success: false, message: "Item name is required." });
    }

    const scope = await findScope(scopeType, scopeId, organizationId);
    if (!scope) {
      return res.status(404).json({
        success: false,
        message: "Property or room not found — pick where this item lives.",
      });
    }

    const item = cleanItem(req.body);

    await scope.Model.updateOne(
      { _id: scopeId, organizationId },
      { $push: { "inventory.items": item }, $set: checkFields(req.body) }
    );

    return res.status(201).json({
      success: true,
      message: "Inventory item added.",
      data: { ...item, _id: String(item._id), scopeType, scopeId: String(scopeId) },
    });
  } catch (error) {
    console.error("Create Inventory Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add inventory item." });
  }
};

// @desc    Edit one inventory item, moving it between scopes if asked
// @route   PUT /api/v1/inventory/:scopeType/:scopeId/:itemId
export const updateInventoryItem = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { scopeType, scopeId, itemId } = req.params;

    if (!str(req.body.item)) {
      return res.status(400).json({ success: false, message: "Item name is required." });
    }
    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }

    const from = await findScope(scopeType, scopeId, organizationId);
    if (!from) {
      return res.status(404).json({ success: false, message: "Inventory item not found." });
    }

    const existing = (from.doc.inventory?.items || []).find(
      (it) => String(it._id) === String(itemId)
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: "Inventory item not found." });
    }

    // Where the item should end up — unchanged unless the form moved it.
    const targetType = req.body.scopeType || scopeType;
    const targetId = req.body.scopeId || scopeId;
    const moving = targetType !== scopeType || String(targetId) !== String(scopeId);

    const item = cleanItem(req.body, existing._id);

    if (!moving) {
      await from.Model.updateOne(
        { _id: scopeId, organizationId, "inventory.items._id": existing._id },
        {
          $set: {
            "inventory.items.$": item,
            ...checkFields(req.body),
          },
        }
      );
    } else {
      const to = await findScope(targetType, targetId, organizationId);
      if (!to) {
        return res.status(404).json({
          success: false,
          message: "The property or room you moved this item to was not found.",
        });
      }

      // Remove then add. Not a transaction: the deployment is a single replica
      // set without one configured, and a half-applied move would at worst
      // leave the row in its original scope — visible, not lost.
      await from.Model.updateOne(
        { _id: scopeId, organizationId },
        { $pull: { "inventory.items": { _id: existing._id } } }
      );
      await to.Model.updateOne(
        { _id: targetId, organizationId },
        { $push: { "inventory.items": item }, $set: checkFields(req.body) }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Inventory item updated.",
      data: {
        ...item,
        _id: String(item._id),
        scopeType: targetType,
        scopeId: String(targetId),
      },
    });
  } catch (error) {
    console.error("Update Inventory Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update inventory item." });
  }
};

// @desc    Remove one inventory item
// @route   DELETE /api/v1/inventory/:scopeType/:scopeId/:itemId
export const deleteInventoryItem = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { scopeType, scopeId, itemId } = req.params;

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item id." });
    }

    const scope = await findScope(scopeType, scopeId, organizationId);
    if (!scope) {
      return res.status(404).json({ success: false, message: "Inventory item not found." });
    }

    const result = await scope.Model.updateOne(
      { _id: scopeId, organizationId },
      { $pull: { "inventory.items": { _id: new mongoose.Types.ObjectId(itemId) } } }
    );

    if (!result.modifiedCount) {
      return res.status(404).json({ success: false, message: "Inventory item not found." });
    }

    return res.status(200).json({ success: true, message: "Inventory item deleted." });
  } catch (error) {
    console.error("Delete Inventory Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete inventory item." });
  }
};
