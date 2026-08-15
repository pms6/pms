// Shared helpers for property and room inventories (schedule of condition).
// Both Property.inventory and Room.inventory use the same item shape, so the
// property form and the standalone inventory page work from these.

export const CONDITIONS = [
  ["NEW", "New"],
  ["GOOD", "Good"],
  ["FAIR", "Fair"],
  ["POOR", "Poor"],
];

export const conditionLabel = (v) => CONDITIONS.find(([k]) => k === v)?.[1] || v;

export const CONDITION_TONE = {
  NEW: "green",
  GOOD: "blue",
  FAIR: "amber",
  POOR: "red",
};

// Suggestions only — the location field stays free text.
export const INVENTORY_LOCATIONS = [
  "Kitchen", "Living room", "Dining room", "Bathroom", "Hallway",
  "Bedroom", "Garden", "Garage", "Communal areas",
];

export const BLANK_ITEM = {
  item: "",
  location: "",
  quantity: 1,
  condition: "GOOD",
  price: "",
  notes: "",
};

// An API item may be missing keys the form expects; fill them in.
export const toFormItem = (it) => ({ ...BLANK_ITEM, ...it, price: it.price ?? "" });

export const itemValue = (it) => (Number(it.quantity) || 0) * (Number(it.price) || 0);

export const inventoryTotal = (items = []) => items.reduce((sum, it) => sum + itemValue(it), 0);

// Drop half-filled rows — an item with no name is just an empty row — and
// coerce the numeric fields the inputs hold as strings.
export const cleanItems = (items = []) =>
  items
    .filter((it) => (it.item || "").trim())
    .map((it) => ({
      item: it.item.trim(),
      location: (it.location || "").trim(),
      quantity: Number(it.quantity) || 1,
      condition: it.condition || "GOOD",
      price: it.price === "" || it.price == null ? null : Number(it.price),
      notes: (it.notes || "").trim(),
    }));
