"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, X, UploadCloud, Loader2, Check, Star, Trash2 } from "lucide-react";
import { PageHeader } from "../Shared/ui";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";
import api from "@/app/api/api";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function SectionTitle({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">{children}</p>;
}

function Panel({ title, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{hint}</p>}
    </div>
  );
}

// A row of mutually exclusive pills. `options` is [value, label] pairs.
function Choice({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${value === v ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

// £ prefix sitting inside the input's rounded box.
function MoneyInput({ value, onChange, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">£</span>
      <input type="number" min="0" step="0.01" className={`${FIELD} pl-8`} value={value} onChange={onChange} {...props} />
    </div>
  );
}

const ROOM_TYPES = [
  ["STANDARD", "Standard"], ["ENSUITE", "Ensuite"], ["STUDIO", "Studio"],
  ["MASTER", "Master"], ["DOUBLE", "Double"], ["SINGLE", "Single"],
];
// "Size of room" — Single/Double lead, Twin/Family kept so existing rooms round-trip.
const OCCUPANCIES = [["SINGLE", "Single"], ["DOUBLE", "Double"], ["TWIN", "Twin"], ["FAMILY", "Family"]];
const STATUSES = [
  ["AVAILABLE", "Available"], ["AVAILABLE_SOON", "Available Soon"], ["RESERVED", "Reserved"],
  ["OCCUPIED", "Occupied"], ["MAINTENANCE", "Maintenance"],
];
const BILLS = [["gas", "Gas"], ["electricity", "Electricity"], ["water", "Water"], ["internet", "Internet"]];

const RENT_PERIODS = [["MONTHLY", "per calendar month"], ["WEEKLY", "per week"]];
const FURNISHINGS = [[true, "Furnished"], [false, "Unfurnished"]];
const YES_NO = [[true, "Yes"], [false, "No"]];
const BILLS_OPTIONS = [["YES", "Yes"], ["NO", "No"], ["SOME", "Some"]];
const DAYS_AVAILABLE = [
  ["SEVEN_DAYS", "7 days a week"],
  ["WEEKDAYS", "Monday to Friday"],
  ["WEEKENDS", "Weekends only"],
];

// Stay lengths in months. 0 = no maximum.
const MIN_STAY = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24];
const stayLabel = (n) => (n === 1 ? "1 month" : `${n} months`);

// Preferences for new flatmate
const SMOKING = [["NO_PREFERENCE", "No preference"], ["YES", "Yes"], ["NO", "No"]];
const GENDER = [["ANY", "Don't mind"], ["MALE", "Male"], ["FEMALE", "Female"]];
const OCCUPATION = [
  ["STUDENTS_ONLY", "Students only"],
  ["NO_STUDENTS", "Not suitable for students"],
  ["ALL", "Available to all"],
];
const PETS = [["NO_PREFERENCE", "No preference"], ["YES", "Yes"], ["NO", "No"]];

// ---------------------------------------------------------------------------
// Draft persistence — same approach as the New Property form.
//
// Only *new* rooms get a saved draft. An edit form is seeded from the server,
// so restoring a stale local copy over it risks quietly reverting someone
// else's change.
// ---------------------------------------------------------------------------
const DRAFT_VERSION = 1;
const draftKey = (propertyId) => `pms:new-room-draft:${propertyId}`;

const EMPTY = {
  roomName: "",
  title: "",
  roomNumber: "",
  description: "",
  monthlyRent: "",
  rentPeriod: "MONTHLY",
  securityDeposit: "",
  holdingDeposit: "",
  roomType: "STANDARD",
  occupancy: "SINGLE",
  ensuite: false,
  status: "AVAILABLE",
  availableFrom: "",
  minimumTenancy: 1,
  maximumTenancy: 0,
  shortTermLets: false,
  daysAvailable: "SEVEN_DAYS",
  referencesRequired: null,
  floor: "",
  furnished: true,
  billsOption: "SOME",
  billsIncluded: { gas: false, electricity: false, water: false, internet: false },
  wifi: null,
  notes: "",
  images: [],
  // Preferences for new flatmate
  prefSmoking: "NO_PREFERENCE",
  prefGender: "ANY",
  prefOccupation: "ALL",
  prefPets: "NO",
  prefMinAge: "",
  prefMaxAge: "",
  prefLanguage: "",
  prefCouples: false,
  prefVegetarian: false,
};

const isPristine = (form) => JSON.stringify(form) === JSON.stringify(EMPTY);

const savedLabel = (ts) => {
  if (!ts) return "";
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return new Date(ts).toLocaleString();
};

// Map an API room document onto the form shape.
const fromApi = (room) => ({
  ...EMPTY,
  roomName: room.roomName || "",
  title: room.title || "",
  roomNumber: room.roomNumber || "",
  description: room.description || "",
  monthlyRent: room.monthlyRent ?? "",
  rentPeriod: room.rentPeriod || "MONTHLY",
  securityDeposit: room.securityDeposit ?? "",
  holdingDeposit: room.holdingDeposit ?? "",
  roomType: room.roomType || "STANDARD",
  occupancy: room.occupancy || "SINGLE",
  ensuite: room.bathroomType === "private",
  status: room.status || "AVAILABLE",
  availableFrom: room.availableFrom ? new Date(room.availableFrom).toISOString().split("T")[0] : "",
  minimumTenancy: room.minimumTenancy ?? 1,
  maximumTenancy: room.maximumTenancy ?? 0,
  shortTermLets: room.shortTermLets ?? false,
  daysAvailable: room.daysAvailable || "SEVEN_DAYS",
  referencesRequired: room.referencesRequired ?? null,
  floor: room.floor || "",
  furnished: room.furnished !== undefined ? room.furnished : true,
  billsOption: room.billsOption || "SOME",
  billsIncluded: { ...EMPTY.billsIncluded, ...(room.billsIncluded || {}) },
  wifi: room.billsIncluded?.wifi ?? null,
  notes: room.notes || "",
  images: room.images || [],
  prefSmoking: room.preferences?.smoking || "NO_PREFERENCE",
  prefGender: room.preferences?.gender || "ANY",
  prefOccupation: room.preferences?.occupation || "ALL",
  prefPets: room.preferences?.pets || "NO",
  prefMinAge: room.preferences?.minAge ?? "",
  prefMaxAge: room.preferences?.maxAge ?? "",
  prefLanguage: room.preferences?.language || "",
  prefCouples: room.preferences?.couplesWelcome ?? false,
  prefVegetarian: room.preferences?.vegetarianPreferred ?? false,
});

const apiService = {
  async getPropertyById(id) {
    try {
      const response = await api.get(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error("Get property error:", error);
      throw error.response?.data || error;
    }
  },
  async getRoomById(id) {
    try {
      const response = await api.get(`/rooms/${id}`);
      return response.data;
    } catch (error) {
      console.error("Get room error:", error);
      throw error.response?.data || error;
    }
  },
  async createRoom(data) {
    try {
      const response = await api.post("/rooms", data);
      return response.data;
    } catch (error) {
      console.error("Create room error:", error);
      throw error.response?.data || error;
    }
  },
  async updateRoom(id, data) {
    try {
      const response = await api.put(`/rooms/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Update room error:", error);
      throw error.response?.data || error;
    }
  },
};

/**
 * Full-page room form — replaces the RoomModal on the property detail board.
 * Renders "Add Room" when there is no [roomId] in the route, "Edit Room" when
 * there is.
 * @param {string} basePath - properties route prefix
 *                            (e.g. "/admin/properties" or "/manager/properties").
 */
export default function RoomForm({ basePath = "/admin/properties" }) {
  const router = useRouter();
  const { id: propertyId, roomId } = useParams();
  const isEdit = Boolean(roomId);
  const propertyHref = `${basePath}/${propertyId}`;
  const storageKey = draftKey(propertyId);

  const [form, setForm] = useState(EMPTY);
  const setField = useCallback((key, value) => setForm((f) => ({ ...f, [key]: value })), []);
  const setBill = (key, value) =>
    setForm((f) => ({ ...f, billsIncluded: { ...f.billsIncluded, [key]: value } }));

  const [propertyName, setPropertyName] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(isEdit);
  const [loadError, setLoadError] = useState("");

  // Draft state (new rooms only)
  const [restored, setRestored] = useState(isEdit); // edit forms never autosave
  const [savedAt, setSavedAt] = useState(null);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const submittedRef = useRef(false);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // --- load the property name (header) and, when editing, the room ----------
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    (async () => {
      try {
        if (isEdit) {
          const res = await apiService.getRoomById(roomId);
          if (cancelled) return;
          setForm(fromApi(res.data));
          setPropertyName(res.data.propertyId?.name || "");
        } else {
          const res = await apiService.getPropertyById(propertyId);
          if (cancelled) return;
          setPropertyName(res.data?.name || "");
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Failed to load room");
      } finally {
        if (!cancelled) setLoadingRoom(false);
      }
    })();

    return () => { cancelled = true; };
  }, [propertyId, roomId, isEdit]);

  // --- restore a saved draft once, on mount (new rooms only) ---------------
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.v === DRAFT_VERSION && parsed.data) {
          setForm({ ...EMPTY, ...parsed.data });
          setSavedAt(parsed.savedAt || null);
          setRestoredNotice(true);
        }
      }
    } catch (err) {
      console.error("Could not read room draft:", err);
    }
    setRestored(true);
  }, [storageKey, isEdit]);

  // --- autosave the draft (debounced) --------------------------------------
  useEffect(() => {
    if (isEdit || !restored || submittedRef.current) return;

    // Both the write and the "back to empty" clear sit inside the debounce, so
    // the pass that runs before the draft is restored gets cancelled rather
    // than wiping the very draft we are about to load.
    const timeoutId = setTimeout(() => {
      try {
        if (isPristine(form)) {
          localStorage.removeItem(storageKey);
          setSavedAt(null);
        } else {
          const ts = Date.now();
          localStorage.setItem(storageKey, JSON.stringify({ v: DRAFT_VERSION, savedAt: ts, data: form }));
          setSavedAt(ts);
        }
      } catch (err) {
        console.error("Could not save room draft:", err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form, restored, storageKey, isEdit]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* quota/private mode */ }
    setSavedAt(null);
    setRestoredNotice(false);
  }, [storageKey]);

  const discardDraft = () => {
    clearDraft();
    setForm(EMPTY);
    setError("");
  };

  // --- images ---------------------------------------------------------------
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    setUploading(true);
    setError("");

    const uploaded = [];
    const failures = [];

    for (const file of files) {
      try {
        const result = await uploadToCloudinary(file);
        uploaded.push({ url: result.url, alt: file.name });
      } catch (err) {
        failures.push(`${file.name}: ${err.message || "upload failed"}`);
      }
    }

    if (uploaded.length > 0) setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
    if (failures.length > 0) setError(failures.join(" · "));
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));

  // The first image is the cover, so "make cover" moves it to the front.
  const makeCover = (index) =>
    setForm((f) => ({ ...f, images: [f.images[index], ...f.images.filter((_, i) => i !== index)] }));

  // --- submit ---------------------------------------------------------------
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.roomName.trim()) {
      setError("Room name is required");
      return;
    }
    if (!form.monthlyRent || Number(form.monthlyRent) <= 0) {
      setError("Cost of room is required and must be greater than 0");
      return;
    }
    if (form.maximumTenancy > 0 && form.maximumTenancy < form.minimumTenancy) {
      setError("Maximum stay cannot be shorter than the minimum stay");
      return;
    }
    if (form.prefMinAge && form.prefMaxAge && Number(form.prefMaxAge) < Number(form.prefMinAge)) {
      setError("Maximum age cannot be lower than the minimum age");
      return;
    }

    setSaving(true);
    try {
      // "Yes"/"No" set every bill one way; "Some" defers to the tick boxes.
      const allBills = (v) => ({ gas: v, electricity: v, water: v, internet: v });
      const bills = form.billsOption === "SOME" ? form.billsIncluded : allBills(form.billsOption === "YES");

      const roomData = {
        propertyId,
        title: form.title.trim() || form.roomName.trim(),
        roomName: form.roomName.trim(),
        roomNumber: form.roomNumber.trim() || undefined,
        description: form.description.trim() || undefined,
        roomType: form.roomType,
        occupancy: form.occupancy,
        bathroomType: form.ensuite ? "private" : "shared",
        furnished: form.furnished,
        floor: form.floor.trim() || undefined,
        monthlyRent: Number(form.monthlyRent),
        rentPeriod: form.rentPeriod,
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : undefined,
        holdingDeposit: form.holdingDeposit ? Number(form.holdingDeposit) : undefined,
        billsOption: form.billsOption,
        billsIncluded: { ...bills, ...(form.wifi === null ? {} : { wifi: form.wifi }) },
        status: form.status,
        availableFrom: form.availableFrom || undefined,
        minimumTenancy: Number(form.minimumTenancy) || 1,
        // 0 in the picker means "no maximum" — send null to clear it.
        maximumTenancy: Number(form.maximumTenancy) || null,
        shortTermLets: form.shortTermLets,
        daysAvailable: form.daysAvailable,
        referencesRequired: form.referencesRequired,
        preferences: {
          smoking: form.prefSmoking,
          gender: form.prefGender,
          occupation: form.prefOccupation,
          pets: form.prefPets,
          minAge: form.prefMinAge === "" ? null : Number(form.prefMinAge),
          maxAge: form.prefMaxAge === "" ? null : Number(form.prefMaxAge),
          language: form.prefLanguage.trim(),
          couplesWelcome: form.prefCouples,
          vegetarianPreferred: form.prefVegetarian,
        },
        notes: form.notes.trim() || undefined,
        images: form.images,
      };

      if (isEdit) {
        await apiService.updateRoom(roomId, roomData);
      } else {
        await apiService.createRoom(roomData);
        submittedRef.current = true; // stop the autosave effect re-writing the draft
        clearDraft();
      }

      router.push(propertyHref);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to save room");
      setSaving(false);
    }
  };

  const busy = saving || uploading;

  if (loadingRoom) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading room...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href={propertyHref} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
          <ArrowLeft size={16} /> Back to property
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Could not load this room</p>
          <p className="text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? "Edit Room" : "New Room"}
        subtitle={propertyName ? `${propertyName} · rooms` : "Add a room to this property"}
        action={
          <Link
            href={propertyHref}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all"
          >
            <ArrowLeft size={18} /> Back to Property
          </Link>
        }
      />

      {restoredNotice && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-blue-800">
            We restored an unfinished room from {savedLabel(savedAt) || "earlier"}.
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900"
          >
            <Trash2 size={13} /> Start fresh
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5 max-w-3xl">
        <Panel title="Room Details">
          <Field label="Room Name *">
            <input className={FIELD} value={form.roomName} onChange={(e) => setField("roomName", e.target.value)} placeholder="Room 1" required />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Room Title (optional)">
              <input className={FIELD} value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g., Spacious Double Room" />
            </Field>
            <Field label="Room Number (optional)">
              <input className={FIELD} value={form.roomNumber} onChange={(e) => setField("roomNumber", e.target.value)} placeholder="e.g., 101, A1" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Room Type">
              <select className={FIELD} value={form.roomType} onChange={(e) => setField("roomType", e.target.value)}>
                {ROOM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Floor">
              <input className={FIELD} value={form.floor} onChange={(e) => setField("floor", e.target.value)} placeholder="e.g., First, 2" />
            </Field>
          </div>

          <Field label="Size of room">
            <Choice options={OCCUPANCIES} value={form.occupancy} onChange={(v) => setField("occupancy", v)} />
          </Field>

          <Field label="Furnishings">
            <Choice options={FURNISHINGS} value={form.furnished} onChange={(v) => setField("furnished", v)} />
          </Field>

          <Field label="Amenities">
            <label
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.ensuite ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              <input
                type="checkbox"
                className="accent-[#F47C3C]"
                checked={form.ensuite}
                onChange={(e) => setField("ensuite", e.target.checked)}
              />
              En-suite (tick if room has own toilet and/or bath/shower)
            </label>
          </Field>

          <Field label="Description (optional)">
            <textarea className={`${FIELD} min-h-[90px] resize-y`} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Describe the room for listings and viewings" />
          </Field>
        </Panel>

        <Panel title="Pricing">
          <Field label="Cost of room *">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <MoneyInput
                  value={form.monthlyRent}
                  onChange={(e) => setField("monthlyRent", e.target.value)}
                  placeholder="650"
                  required
                />
              </div>
              <Choice options={RENT_PERIODS} value={form.rentPeriod} onChange={(v) => setField("rentPeriod", v)} />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Security Deposit">
              <MoneyInput value={form.securityDeposit} onChange={(e) => setField("securityDeposit", e.target.value)} placeholder="750" />
            </Field>
            <Field label="Holding Deposit">
              <MoneyInput value={form.holdingDeposit} onChange={(e) => setField("holdingDeposit", e.target.value)} placeholder="150" />
            </Field>
          </div>

          <Field label="Bills included?">
            <Choice options={BILLS_OPTIONS} value={form.billsOption} onChange={(v) => setField("billsOption", v)} />
          </Field>

          {form.billsOption === "SOME" && (
            <Field label="Which bills?">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BILLS.map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.billsIncluded[key] ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#F47C3C]"
                      checked={form.billsIncluded[key]}
                      onChange={(e) => setBill(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label="Wifi">
            <Choice options={YES_NO} value={form.wifi} onChange={(v) => setField("wifi", v)} />
          </Field>
        </Panel>

        <Panel title="Availability">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status">
              <select className={FIELD} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Available from">
              <input type="date" className={FIELD} value={form.availableFrom} onChange={(e) => setField("availableFrom", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Minimum stay">
              <select className={FIELD} value={form.minimumTenancy} onChange={(e) => setField("minimumTenancy", Number(e.target.value))}>
                {MIN_STAY.map((n) => <option key={n} value={n}>{stayLabel(n)}</option>)}
              </select>
            </Field>
            <Field
              label="Maximum stay"
              hint="It may not be legal to specify fixed terms."
            >
              <select className={FIELD} value={form.maximumTenancy} onChange={(e) => setField("maximumTenancy", Number(e.target.value))}>
                <option value={0}>No maximum</option>
                {MIN_STAY.map((n) => <option key={n} value={n}>{stayLabel(n)}</option>)}
              </select>
            </Field>
          </div>

          <Field
            label="Short term lets considered?"
            hint="i.e. 1 week to 3 months. Please specify any rent adjustments in the description."
          >
            <label
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.shortTermLets ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              <input
                type="checkbox"
                className="accent-[#F47C3C]"
                checked={form.shortTermLets}
                onChange={(e) => setField("shortTermLets", e.target.checked)}
              />
              Tick for yes
            </label>
          </Field>

          <Field label="Days available">
            <select className={FIELD} value={form.daysAvailable} onChange={(e) => setField("daysAvailable", e.target.value)}>
              {DAYS_AVAILABLE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

          <Field label="References required?">
            <Choice options={YES_NO} value={form.referencesRequired} onChange={(v) => setField("referencesRequired", v)} />
          </Field>

          <Field label="Room Notes">
            <textarea className={`${FIELD} min-h-[90px] resize-y`} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Add room features, access notes, or viewing instructions" />
          </Field>
        </Panel>

        <Panel title="Preferences for new flatmate">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Smoking OK?">
              <select className={FIELD} value={form.prefSmoking} onChange={(e) => setField("prefSmoking", e.target.value)}>
                {SMOKING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field
              label="Gender"
              hint="As a live-out landlord, you can't discriminate on gender."
            >
              <select className={FIELD} value={form.prefGender} onChange={(e) => setField("prefGender", e.target.value)}>
                {GENDER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Occupation">
            <Choice options={OCCUPATION} value={form.prefOccupation} onChange={(v) => setField("prefOccupation", v)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Pets suitable">
              <select className={FIELD} value={form.prefPets} onChange={(e) => setField("prefPets", e.target.value)}>
                {PETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <input className={FIELD} value={form.prefLanguage} onChange={(e) => setField("prefLanguage", e.target.value)} placeholder="e.g., English" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Minimum age">
              <input type="number" min="16" max="120" className={FIELD} value={form.prefMinAge} onChange={(e) => setField("prefMinAge", e.target.value)} placeholder="25" />
            </Field>
            <Field label="Maximum age">
              <input type="number" min="16" max="120" className={FIELD} value={form.prefMaxAge} onChange={(e) => setField("prefMaxAge", e.target.value)} placeholder="60" />
            </Field>
          </div>

          <Field
            label="Couples welcome?"
            hint="Specify any rent adjustments in the description."
          >
            <Choice options={[[false, "No"], [true, "Yes"]]} value={form.prefCouples} onChange={(v) => setField("prefCouples", v)} />
          </Field>

          <Field label="Other preferences">
            <label
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.prefVegetarian ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
            >
              <input
                type="checkbox"
                className="accent-[#F47C3C]"
                checked={form.prefVegetarian}
                onChange={(e) => setField("prefVegetarian", e.target.checked)}
              />
              Vegetarian/vegan preferred
            </label>
          </Field>
        </Panel>

        <Panel title="Photos">
          <div>
            <label className={LABEL}>
              Room Images {uploading && <Loader2 size={14} className="inline animate-spin ml-2" />}
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2">
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
              </div>
              <p className="text-sm font-bold text-[#0F253B]">Drag &amp; drop images</p>
              <p className="text-xs text-gray-400 font-medium">or click to browse (max 10MB each)</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                disabled={uploading}
              />
            </div>

            {form.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {form.images.map((im, i) => (
                  <div key={`${im.url}-${i}`} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    <img src={im.url} alt={im.alt || `Room photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      title="Remove"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    {i === 0 ? (
                      <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#0F253B] text-white px-1.5 py-0.5 rounded">Cover</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeCover(i)}
                        title="Make cover image"
                        className="absolute bottom-1 left-1 flex items-center gap-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Star size={9} /> Cover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 min-h-[16px]">
            {savedAt && (
              <>
                <Check size={13} className="text-green-600" />
                Draft saved on this device · {savedLabel(savedAt)}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <button
                type="button"
                onClick={discardDraft}
                disabled={busy}
                className="px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Discard draft
              </button>
            )}
            <Link
              href={propertyHref}
              className="px-5 py-3 bg-gray-50 hover:bg-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              {saving ? "Saving..." : uploading ? "Uploading Images..." : isEdit ? "Save Room" : "Add Room"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
