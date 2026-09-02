"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Check,
  Loader2,
  Package,
  Building2,
  DoorOpen,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { PageHeader, Badge } from "../Shared/ui";
import { formatMoney } from "@/app/utils/listings";
import {
  CONDITIONS,
  CONDITION_TONE,
  INVENTORY_LOCATIONS,
  BLANK_ITEM,
  toFormItem,
  itemValue,
  inventoryTotal,
  cleanItems,
} from "@/app/utils/inventory";
import api from "@/app/api/api";
import uploadToCloudinary from "../utils/uploadToCloudinary";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// Sentinel for the "whole property" scope, so it can share the room <select>.
const WHOLE_PROPERTY = "__property__";

const apiService = {
  async getProperties() {
    try {
      const response = await api.get("/properties?page=1&limit=200");
      return response.data;
    } catch (error) {
      console.error("Get properties error:", error);
      throw error.response?.data || error;
    }
  },
  async getPropertyById(id) {
    try {
      const response = await api.get(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error("Get property error:", error);
      throw error.response?.data || error;
    }
  },
  async getRoomsByProperty(propertyId) {
    try {
      const response = await api.get(`/rooms/property/${propertyId}`);
      return response.data;
    } catch (error) {
      console.error("Get rooms error:", error);
      throw error.response?.data || error;
    }
  },
  async saveProperty(id, data) {
    try {
      const response = await api.put(`/properties/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Save property inventory error:", error);
      throw error.response?.data || error;
    }
  },
  async saveRoom(id, data) {
    try {
      const response = await api.put(`/rooms/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Save room inventory error:", error);
      throw error.response?.data || error;
    }
  },
};

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

/**
 * Standalone inventory surface — pick a property, then the whole property or one
 * of its rooms, and edit that scope's schedule of condition.
 * Each item supports multiple photos (Cloudinary).
 */
export default function InventoryBoard() {
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [propertyId, setPropertyId] = useState("");
  const [scope, setScope] = useState(WHOLE_PROPERTY);

  const [checkedOn, setCheckedOn] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [items, setItems] = useState([]);

  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingScope, setLoadingScope] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  // Track which item is currently uploading (index → true)
  const [uploading, setUploading] = useState({});
  const fileInputRefs = useRef({});

  // --- properties, once -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getProperties();
        if (!cancelled) setProperties(res.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load properties");
      } finally {
        if (!cancelled) setLoadingProperties(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- rooms for the chosen property ---------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = propertyId
        ? await apiService.getRoomsByProperty(propertyId).catch((err) => {
            console.error("Rooms load failed:", err);
            return null;
          })
        : null;

      if (!cancelled) setRooms(res?.data || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  // --- the selected scope's inventory --------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let inventory = null;
      let failure = "";

      if (propertyId && scope === WHOLE_PROPERTY) {
        setLoadingScope(true);
        try {
          const res = await apiService.getPropertyById(propertyId);
          inventory = res.data?.inventory;
        } catch (err) {
          failure = err.message || "Failed to load inventory";
        }
      } else if (propertyId) {
        inventory = rooms.find((r) => r._id === scope)?.inventory;
      }

      if (cancelled) return;

      setError(failure);
      setSavedAt(null);
      setCheckedOn(toDateInput(inventory?.checkedOn));
      setCheckedBy(inventory?.checkedBy || "");
      setItems((inventory?.items || []).map(toFormItem));
      setLoadingScope(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, scope, rooms]);

  // --- rows -----------------------------------------------------------------
  const addItem = () => setItems((prev) => [...prev, { ...BLANK_ITEM }]);

  const setItem = (index, key, value) =>
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [key]: value } : it))
    );

  const removeItem = (index) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  // --- images ---------------------------------------------------------------
  const handleImageUpload = async (index, files) => {
    if (!files?.length) return;

    setUploading((u) => ({ ...u, [index]: true }));
    setError("");

    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const result = await uploadToCloudinary(file);
        uploaded.push({ url: result.url, publicId: result.publicId });
      }

      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? { ...it, images: [...(it.images || []), ...uploaded] }
            : it
        )
      );
    } catch (err) {
      setError(err.message || "Failed to upload image(s)");
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next[index];
        return next;
      });
      // reset the file input so the same files can be selected again
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index].value = "";
      }
    }
  };

  const removeImage = (itemIndex, imageIndex) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIndex
          ? {
              ...it,
              images: (it.images || []).filter((_, j) => j !== imageIndex),
            }
          : it
      )
    );
  };

  // --- save -----------------------------------------------------------------
  const save = async () => {
    setSaving(true);
    setError("");

    const inventory = {
      checkedOn: checkedOn || null,
      checkedBy: checkedBy.trim(),
      items: cleanItems(items),
    };

    try {
      if (scope === WHOLE_PROPERTY) {
        await apiService.saveProperty(propertyId, { inventory });
      } else {
        await apiService.saveRoom(scope, { inventory });
        // Keep the cached room in step so switching scope and back is correct.
        setRooms((prev) =>
          prev.map((r) => (r._id === scope ? { ...r, inventory } : r))
        );
      }
      setItems(inventory.items.map(toFormItem)); // drop the blank rows we filtered
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message || "Failed to save inventory");
    } finally {
      setSaving(false);
    }
  };

  const property = properties.find((p) => p._id === propertyId);
  const room = rooms.find((r) => r._id === scope);
  const scopeLabel =
    scope === WHOLE_PROPERTY ? "Whole property" : room?.roomName || "Room";
  const total = inventoryTotal(items);
  const namedCount = items.filter((it) => it.item.trim()).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Schedule of condition for each property and room"
        action={
          propertyId ? (
            <button
              onClick={save}
              disabled={saving || loadingScope}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
              {saving ? "Saving..." : "Save Inventory"}
            </button>
          ) : null
        }
      />

      {/* Scope selector */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>
            <Building2 size={11} className="inline mr-1 -mt-0.5" /> Property
          </label>
          <select
            className={FIELD}
            value={propertyId}
            disabled={loadingProperties}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setScope(WHOLE_PROPERTY);
            }}
          >
            <option value="">
              {loadingProperties
                ? "Loading properties..."
                : "Select a property..."}
            </option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
                {p.address?.city ? ` · ${p.address.city}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>
            <DoorOpen size={11} className="inline mr-1 -mt-0.5" /> Room
          </label>
          <select
            className={FIELD}
            value={scope}
            disabled={!propertyId}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value={WHOLE_PROPERTY}>
              Whole property (shared &amp; communal)
            </option>
            {rooms.map((r) => (
              <option key={r._id} value={r._id}>
                {r.roomName}
              </option>
            ))}
          </select>
          {propertyId && rooms.length === 0 && (
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">
              This property has no rooms yet.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
          {error}
        </div>
      )}

      {!propertyId ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white text-[#F47C3C] flex items-center justify-center mb-3">
            <Package size={22} />
          </div>
          <p className="text-gray-500 font-medium">
            Select a property to view its inventory
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Then choose the whole property or one of its rooms.
          </p>
        </div>
      ) : loadingScope ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-600 font-medium">
              Loading inventory...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Scope", value: scopeLabel, small: true },
              { label: "Property", value: property?.name || "—", small: true },
              { label: "Items", value: namedCount },
              {
                label: "Total value",
                value: total ? formatMoney(total) : "—",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white border border-gray-100 rounded-2xl p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {s.label}
                </p>
                <p
                  className={`font-bold text-[#0F253B] truncate mt-0.5 ${
                    s.small ? "text-sm" : "text-xl"
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Check details */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Checked on</label>
              <input
                type="date"
                className={FIELD}
                value={checkedOn}
                onChange={(e) => setCheckedOn(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Checked by</label>
              <input
                className={FIELD}
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder="e.g., Sarah Khan"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
                Items in {scopeLabel}
              </p>
              {savedAt && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
                  <Check size={13} /> Saved
                </span>
              )}
            </div>

            <datalist id="inventory-locations">
              {INVENTORY_LOCATIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>

            {items.length === 0 ? (
              <p className="text-center text-sm text-gray-400 font-medium border-2 border-dashed border-gray-100 rounded-2xl py-10">
                No items yet — add what this{" "}
                {scope === WHOLE_PROPERTY ? "property" : "room"} is let with.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Desktop header */}
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_4rem_minmax(0,1fr)_6.5rem_6rem_minmax(0,2fr)_2rem] gap-2 px-1">
                  {[
                    "Item",
                    "Location",
                    "Qty",
                    "Condition",
                    "Price",
                    "Value",
                    "Notes",
                  ].map((h) => (
                    <span
                      key={h}
                      className="text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {items.map((it, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 lg:bg-transparent border border-gray-100 lg:border-0 rounded-xl lg:rounded-none p-3 lg:p-0 space-y-3"
                  >
                    {/* Main fields row */}
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_4rem_minmax(0,1fr)_6.5rem_6rem_minmax(0,2fr)_2rem] gap-2 items-center">
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Item</label>
                        <input
                          className={`${FIELD} bg-white`}
                          value={it.item}
                          onChange={(e) => setItem(i, "item", e.target.value)}
                          placeholder="e.g., Washing machine"
                        />
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Location</label>
                        <input
                          className={`${FIELD} bg-white`}
                          list="inventory-locations"
                          value={it.location}
                          onChange={(e) =>
                            setItem(i, "location", e.target.value)
                          }
                          placeholder="Kitchen"
                        />
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Qty</label>
                        <input
                          type="number"
                          min="0"
                          className={`${FIELD} bg-white px-2 text-center`}
                          value={it.quantity}
                          onChange={(e) =>
                            setItem(i, "quantity", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>
                          Condition
                        </label>
                        <select
                          className={`${FIELD} bg-white px-2`}
                          value={it.condition}
                          onChange={(e) =>
                            setItem(i, "condition", e.target.value)
                          }
                        >
                          {CONDITIONS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                            £
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${FIELD} bg-white pl-7 pr-2`}
                            value={it.price}
                            onChange={(e) =>
                              setItem(i, "price", e.target.value)
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Value</label>
                        <p className="px-1 py-3 text-sm font-bold text-[#0F253B] tabular-nums">
                          {itemValue(it) ? formatMoney(itemValue(it)) : "—"}
                        </p>
                      </div>
                      <div>
                        <label className={`${LABEL} lg:hidden`}>Notes</label>
                        <input
                          className={`${FIELD} bg-white`}
                          value={it.notes}
                          onChange={(e) => setItem(i, "notes", e.target.value)}
                          placeholder="Small scratch on door"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        title="Remove item"
                        className="justify-self-start lg:justify-self-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Photos row */}
                    {/* Photos row */}
                    <div className="pl-0 lg:pl-1">
                      <label className={LABEL}>Photos</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {(it.images || []).map((img, j) => (
                          <div
                            key={j}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white"
                          >
                            <img
                              src={img.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {/* Red X remove button */}
                            <button
                              type="button"
                              onClick={() => removeImage(i, j)}
                              title="Remove photo"
                              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm transition-colors"
                            >
                              <X size={12} strokeWidth={3} />
                            </button>
                          </div>
                        ))}

                        <label
                          className={`flex items-center justify-center w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 bg-white cursor-pointer hover:border-[#F47C3C] hover:bg-orange-50 transition-colors ${
                            uploading[i] ? "opacity-50 pointer-events-none" : ""
                          }`}
                          title="Add photos"
                        >
                          {uploading[i] ? (
                            <Loader2 size={18} className="animate-spin text-[#F47C3C]" />
                          ) : (
                            <ImagePlus size={18} className="text-gray-400" />
                          )}
                          <input
                            ref={(el) => (fileInputRefs.current[i] = el)}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleImageUpload(i, e.target.files)}
                          />
                        </label>
                      </div>
                      {(it.images || []).length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {(it.images || []).length} photo
                          {(it.images || []).length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Total
                  </span>
                  <span className="text-lg font-bold text-[#0F253B] tabular-nums">
                    {total ? formatMoney(total) : "—"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-[#0F253B] font-bold text-xs rounded-xl transition-all"
              >
                <Plus size={16} /> Add item
              </button>

              {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map(([v, l]) => {
                    const n = items.filter(
                      (it) => it.item.trim() && it.condition === v
                    ).length;
                    return n > 0 ? (
                      <Badge key={v} tone={CONDITION_TONE[v]}>
                        {n} {l}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}