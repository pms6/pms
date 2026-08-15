"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  X,
  UploadCloud,
  Loader2,
  Check,
  Star,
  Trash2,
  FileText,
  Plus,
} from "lucide-react";
import { PageHeader } from "../Shared/ui";
import { RENTAL_TYPES, TENANT_TYPES, RENTAL_TYPE_API, rentalTypeLabel } from "../admin/_data/dummy";
import uploadToCloudinary, { uploadFileToCloudinary } from "@/app/utils/uploadToCloudinary";
import { formatMoney } from "@/app/utils/listings";
import {
  CONDITIONS,
  INVENTORY_LOCATIONS,
  BLANK_ITEM,
  toFormItem,
  inventoryTotal,
  cleanItems,
} from "@/app/utils/inventory";
import api from "@/app/api/api";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function SectionTitle({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">{children}</p>;
}

function TextField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><input className={FIELD} {...props} /></div>;
}

function TextAreaField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><textarea className={`${FIELD} min-h-[90px] resize-y`} {...props} /></div>;
}

// `labels` optionally maps a value to nicer display text; without it the value
// is shown as-is.
function Segmented({ options, value, onChange, labels }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${value === o ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

// A white panel that groups one part of the form.
function Panel({ title, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

// Yes / No pair, used for the shared-living-room question.
function YesNo({ value, onChange, yesLabel = "Yes", noLabel = "No" }) {
  const base = "px-4 py-2.5 rounded-xl text-xs font-bold border transition-all";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange(true)}
        className={`${base} ${value === true ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
        {yesLabel}
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`${base} ${value === false ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
        {noLabel}
      </button>
    </div>
  );
}

// Values here must match the enums on the Property schema.
const TRANSPORT_MINUTES = ["0-5", "5-10", "10-15", "15-20", "20-30", "30+"];
const TRANSPORT_MODES = [
  ["walk", "walk"], ["bus", "bus"], ["train", "train"], ["tube", "tube"], ["tram", "tram"],
];
const AMENITIES = [
  ["parking", "Parking"],
  ["garden_patio", "Garden/patio"],
  ["garage", "Garage"],
  ["balcony_terrace", "Balcony/roof terrace"],
  ["disabled_access", "Disabled access"],
];

const AGREEMENT_TYPES = [
  ["AST", "Assured Shorthold Tenancy"],
  ["COMPANY_LET", "Company Let"],
  ["LICENCE", "Licence to Occupy"],
  ["LODGER", "Lodger Agreement"],
  ["OTHER", "Other"],
];
const CONTRACT_RENT_PERIODS = [["MONTHLY", "per calendar month"], ["WEEKLY", "per week"]];
const NOTICE_MONTHS = [1, 2, 3, 6];
const DEPOSIT_SCHEMES = [
  ["NONE", "Not protected yet"],
  ["DPS", "Deposit Protection Service"],
  ["MYDEPOSITS", "mydeposits"],
  ["TDS", "Tenancy Deposit Scheme"],
];
const DOCUMENT_TYPES = [
  ["CONTRACT", "Contract"],
  ["INSURANCE", "Insurance"],
  ["INVENTORY", "Inventory"],
  ["FLOOR_PLAN", "Floor plan"],
  ["LICENCE", "Licence"],
  ["OTHER", "Other"],
];
const docTypeLabel = (v) => DOCUMENT_TYPES.find(([k]) => k === v)?.[1] || "Other";


// ---------------------------------------------------------------------------
// Draft persistence
//
// The create form is a full page now, so a stray back/refresh used to cost the
// whole form. Everything below is kept in localStorage as you type and cleared
// once the property is actually created. Photos are stored as the Cloudinary
// URLs they were uploaded to (never as base64 — that blows the storage quota).
// ---------------------------------------------------------------------------
const DRAFT_VERSION = 1;
const draftKey = (basePath) => `pms:new-property-draft:${basePath}`;

const EMPTY = {
  name: "",
  address: "",
  area: "",
  city: "",
  postcode: "",
  ownerName: "",
  description: "",
  rentalType: "HMO",
  tenantType: "ANY",
  status: "ACTIVE",
  coordinates: null,
  photos: [],
  // More about the property
  transportMinutes: "0-5",
  transportMode: "walk",
  transportStation: "",
  livingRoom: null,
  amenities: [],
  // Contract
  agreementType: "AST",
  contractStart: "",
  contractEnd: "",
  contractRent: "",
  contractRentPeriod: "MONTHLY",
  noticeMonths: 1,
  depositScheme: "NONE",
  depositAmount: "",
  landlordName: "",
  tenantName: "",
  rollsToPeriodic: true,
  contractNotes: "",
  documents: [],
  // Inventory
  inventoryCheckedOn: "",
  inventoryCheckedBy: "",
  inventoryItems: [],
};

const toDateInput = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

const isPristine = (form) => JSON.stringify(form) === JSON.stringify(EMPTY);

const savedLabel = (ts) => {
  if (!ts) return "";
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return new Date(ts).toLocaleString();
};

// Map an API property document onto the form shape.
const fromApi = (property) => ({
  ...EMPTY,
  name: property.name || "",
  address: property.address?.line1 || "",
  area: property.address?.area || "",
  city: property.address?.city || "",
  postcode: property.address?.postcode || "",
  ownerName: property.ownerName || "",
  description: property.description || "",
  rentalType: rentalTypeLabel(property.rentalType),
  tenantType: property.tenantType || "ANY",
  status: property.status || "ACTIVE",
  coordinates:
    property.location?.lat != null && property.location?.lng != null
      ? { lat: property.location.lat, lng: property.location.lng }
      : null,
  // coverImage is simply the first photo — see the photos handling below.
  photos: [property.coverImage, ...(property.gallery || [])].filter(Boolean),
  transportMinutes: property.transport?.minutes || EMPTY.transportMinutes,
  transportMode: property.transport?.mode || EMPTY.transportMode,
  transportStation: property.transport?.station || "",
  livingRoom: property.livingRoom ?? null,
  amenities: property.amenities || [],
  agreementType: property.contract?.agreementType || "AST",
  contractStart: toDateInput(property.contract?.startDate),
  contractEnd: toDateInput(property.contract?.endDate),
  contractRent: property.contract?.rentAmount ?? "",
  contractRentPeriod: property.contract?.rentPeriod || "MONTHLY",
  noticeMonths: property.contract?.noticeMonths ?? 1,
  depositScheme: property.contract?.depositScheme || "NONE",
  depositAmount: property.contract?.depositAmount ?? "",
  landlordName: property.contract?.landlordName || "",
  tenantName: property.contract?.tenantName || "",
  rollsToPeriodic: property.contract?.rollsToPeriodic ?? true,
  contractNotes: property.contract?.notes || "",
  documents: property.documents || [],
  inventoryCheckedOn: toDateInput(property.inventory?.checkedOn),
  inventoryCheckedBy: property.inventory?.checkedBy || "",
  inventoryItems: (property.inventory?.items || []).map(toFormItem),
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
  async createProperty(data) {
    try {
      const response = await api.post("/properties", data);
      return response.data;
    } catch (error) {
      console.error("Create property error:", error);
      throw error.response?.data || error;
    }
  },
  async updateProperty(id, data) {
    try {
      const response = await api.put(`/properties/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Update property error:", error);
      throw error.response?.data || error;
    }
  },
};

/**
 * Full-page property form — replaces the old modal on the properties board.
 * Renders "New Property" on `${basePath}/new` and "Edit Property" on
 * `${basePath}/[id]/edit`, where the route supplies the id.
 * @param {string} basePath - route prefix of the owning properties section
 *                            (e.g. "/admin/properties" or "/manager/properties").
 */
export default function PropertyForm({ basePath = "/admin/properties" }) {
  const router = useRouter();
  const { id } = useParams();
  const isEdit = Boolean(id);
  // Editing returns to the property; creating returns to the list.
  const returnHref = isEdit ? `${basePath}/${id}` : basePath;
  const storageKey = draftKey(basePath);

  const [form, setForm] = useState(EMPTY);
  const setField = useCallback((key, value) => setForm((f) => ({ ...f, [key]: value })), []);

  const [loadingProperty, setLoadingProperty] = useState(isEdit);
  const [loadError, setLoadError] = useState("");

  // Draft state (new properties only)
  const [restored, setRestored] = useState(isEdit); // edit forms never autosave
  const [savedAt, setSavedAt] = useState(null);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const submittedRef = useRef(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const skipSuggestRef = useRef(true); // don't query on restore/select
  const addressBoxRef = useRef(null);

  // Photos
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // Documents
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const docInputRef = useRef(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // --- load the property when editing --------------------------------------
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiService.getPropertyById(id);
        if (cancelled) return;
        setForm(fromApi(res.data));
        skipSuggestRef.current = true; // seeding the address must not open the list
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Failed to load property");
      } finally {
        if (!cancelled) setLoadingProperty(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, isEdit]);

  // --- restore any saved draft once, on mount (new properties only) --------
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
      console.error("Could not read property draft:", err);
    }
    setRestored(true);
  }, [storageKey, isEdit]);

  // --- autosave the draft (debounced) --------------------------------------
  useEffect(() => {
    if (isEdit || !restored || submittedRef.current) return;

    // Both the write and the "back to empty" clear happen inside the debounce,
    // so the pass that runs before the draft is restored gets cancelled rather
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
        console.error("Could not save property draft:", err);
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
    setSuggestions([]);
    setError("");
    skipSuggestRef.current = true;
  };

  // --- address autocomplete (debounced on the value, not the keystroke) -----
  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      return;
    }

    const query = form.address;
    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        return;
      }

      setLoadingLocation(true);
      try {
        const res = await fetch(
          `https://api.locationiq.com/v1/autocomplete?key=${process.env.NEXT_PUBLIC_LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&limit=5&countrycodes=gb&format=json`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Location search failed");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("LocationIQ error:", err);
          setSuggestions([]);
        }
      } finally {
        setLoadingLocation(false);
      }
    }, 350);

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [form.address]);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    if (suggestions.length === 0) return;
    const onDown = (e) => {
      if (addressBoxRef.current && !addressBoxRef.current.contains(e.target)) setSuggestions([]);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestions.length]);

  const fetchCoordinates = async (query) => {
    try {
      const res = await fetch(
        `https://api.locationiq.com/v1/search?key=${process.env.NEXT_PUBLIC_LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      if (!res.ok) throw new Error("Geocoding failed");
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        return { lat: parseFloat(lat), lng: parseFloat(lon) };
      }
      return null;
    } catch (err) {
      console.error("Geocode error:", err);
      return null;
    }
  };

  const handleAddressSelect = async (suggestion) => {
    const selected =
      suggestion.display_name || suggestion.address?.address_line1 || suggestion.address?.name || "";

    skipSuggestRef.current = true; // picking a suggestion must not re-open the list
    setSuggestions([]);

    const a = suggestion.address || {};
    setForm((f) => ({
      ...f,
      address: selected,
      name: f.name || selected,
      // LocationIQ calls the sub-city district a suburb/neighbourhood.
      area: a.suburb || a.neighbourhood || a.city_district || f.area,
      city: a.city || a.town || a.village || f.city,
      postcode: a.postcode || f.postcode,
    }));

    const coords = await fetchCoordinates(selected);
    if (coords) setField("coordinates", coords);
  };

  const toggleAmenity = (key) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter((a) => a !== key)
        : [...f.amenities, key],
    }));

  // --- photos ---------------------------------------------------------------
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    setUploading(true);
    setError("");

    const urls = [];
    const failures = [];

    for (const file of files) {
      try {
        const result = await uploadToCloudinary(file);
        urls.push(result.url);
      } catch (err) {
        failures.push(`${file.name}: ${err.message || "upload failed"}`);
      }
    }

    if (urls.length > 0) setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    if (failures.length > 0) setError(failures.join(" · "));
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removePhoto = (index) =>
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }));

  // The first photo is the cover, so "make cover" just moves it to the front.
  const makeCover = (index) =>
    setForm((f) => ({ ...f, photos: [f.photos[index], ...f.photos.filter((_, i) => i !== index)] }));

  // --- documents ------------------------------------------------------------
  // Uses the `auto` Cloudinary endpoint so PDFs are accepted alongside images.
  const handleDocuments = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploadingDocs(true);
    setError("");

    const uploaded = [];
    const failures = [];

    for (const file of files) {
      try {
        const result = await uploadFileToCloudinary(file);
        // First upload defaults to Contract — it is what most people add first.
        uploaded.push({ name: result.name, url: result.url, type: "CONTRACT" });
      } catch (err) {
        failures.push(`${file.name}: ${err.message || "upload failed"}`);
      }
    }

    if (uploaded.length > 0) setForm((f) => ({ ...f, documents: [...f.documents, ...uploaded] }));
    if (failures.length > 0) setError(failures.join(" · "));
    setUploadingDocs(false);
  };

  // --- inventory ------------------------------------------------------------
  const addInventoryItem = () =>
    setForm((f) => ({ ...f, inventoryItems: [...f.inventoryItems, { ...BLANK_ITEM }] }));

  const setInventoryItem = (index, key, value) =>
    setForm((f) => ({
      ...f,
      inventoryItems: f.inventoryItems.map((it, i) => (i === index ? { ...it, [key]: value } : it)),
    }));

  const removeInventoryItem = (index) =>
    setForm((f) => ({ ...f, inventoryItems: f.inventoryItems.filter((_, i) => i !== index) }));

  const setDocumentType = (index, type) =>
    setForm((f) => ({
      ...f,
      documents: f.documents.map((d, i) => (i === index ? { ...d, type } : d)),
    }));

  const removeDocument = (index) =>
    setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== index) }));

  // --- submit ---------------------------------------------------------------
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim() || form.address.trim();
    if (!name) {
      setError("Property name is required");
      return;
    }
    if (!form.address.trim()) {
      setError("Property address is required");
      return;
    }
    if (form.contractStart && form.contractEnd && form.contractEnd < form.contractStart) {
      setError("Contract end date cannot be before the start date");
      return;
    }

    setSaving(true);
    try {
      const propertyData = {
        name,
        rentalType: RENTAL_TYPE_API[form.rentalType] || form.rentalType,
        tenantType: form.tenantType,
        ownerName: form.ownerName.trim(),
        address: {
          line1: form.address.trim(),
          area: form.area.trim(),
          city: form.city.trim(),
          postcode: form.postcode.trim(),
          country: "United Kingdom",
        },
        // The Property schema stores location as plain { lat, lng }.
        ...(form.coordinates ? { location: form.coordinates } : {}),
        description: form.description.trim(),
        // Transport is only meaningful once a station is named — an empty
        // station would otherwise persist a stray "0-5 minutes walk from".
        ...(form.transportStation.trim()
          ? {
              transport: {
                minutes: form.transportMinutes,
                mode: form.transportMode,
                station: form.transportStation.trim(),
              },
            }
          : {}),
        ...(form.livingRoom === null ? {} : { livingRoom: form.livingRoom }),
        amenities: form.amenities,
        contract: {
          agreementType: form.agreementType,
          startDate: form.contractStart || null,
          endDate: form.contractEnd || null,
          rentAmount: form.contractRent === "" ? null : Number(form.contractRent),
          rentPeriod: form.contractRentPeriod,
          noticeMonths: Number(form.noticeMonths) || 1,
          depositScheme: form.depositScheme,
          depositAmount: form.depositAmount === "" ? null : Number(form.depositAmount),
          landlordName: form.landlordName.trim(),
          tenantName: form.tenantName.trim(),
          rollsToPeriodic: form.rollsToPeriodic,
          notes: form.contractNotes.trim(),
        },
        inventory: {
          checkedOn: form.inventoryCheckedOn || null,
          checkedBy: form.inventoryCheckedBy.trim(),
          items: cleanItems(form.inventoryItems),
        },
        documents: form.documents,
        coverImage: form.photos[0] || "",
        gallery: form.photos.slice(1),
        status: form.status,
      };

      if (isEdit) {
        await apiService.updateProperty(id, propertyData);
      } else {
        await apiService.createProperty(propertyData);
        submittedRef.current = true; // stop the autosave effect re-writing the draft
        clearDraft();
      }

      router.push(returnHref);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || `Failed to ${isEdit ? "update" : "create"} property`);
      setSaving(false);
    }
  };

  const busy = saving || uploading || uploadingDocs;

  if (loadingProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading property...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
          <ArrowLeft size={16} /> Back to properties
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Could not load this property</p>
          <p className="text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isEdit ? "Edit Property" : "New Property"}
        subtitle={isEdit ? form.name || "Update this property" : "Add a property to your portfolio"}
        action={
          <Link
            href={returnHref}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all"
          >
            <ArrowLeft size={18} /> {isEdit ? "Back to Property" : "Back to Properties"}
          </Link>
        }
      />

      {restoredNotice && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-blue-800">
            We restored an unfinished property from {savedLabel(savedAt) || "earlier"}.
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
        <Panel title="Property Details">
          <TextField
            label="Property Name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g., Melrose House"
            required
          />

          <div className="relative" ref={addressBoxRef}>
            <label className={LABEL}>Street Name *</label>
            <input
              className={FIELD}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSuggestions([])}
              placeholder="e.g., 10 Downing Street"
              autoComplete="off"
              required
            />

            {(suggestions.length > 0 || loadingLocation) && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleAddressSelect(suggestion)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
                  >
                    <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-[#0F253B]">
                        {suggestion.address?.name || suggestion.address?.address_line1 || suggestion.display_name?.split(",")[0] || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {suggestion.address?.city || suggestion.address?.town || suggestion.address?.village || ""}
                        {suggestion.address?.postcode && `, ${suggestion.address.postcode}`}
                      </p>
                    </div>
                  </button>
                ))}
                {loadingLocation && (
                  <div className="px-4 py-3 text-center">
                    <Loader2 size={16} className="animate-spin inline-block mr-2 text-gray-400" />
                    <span className="text-sm text-gray-400">Searching...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField
              label="Area"
              value={form.area}
              onChange={(e) => setField("area", e.target.value)}
              placeholder="e.g., Green Park"
            />
            <TextField
              label="City"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="e.g., London"
            />
            <TextField
              label="Postcode"
              value={form.postcode}
              onChange={(e) => setField("postcode", e.target.value)}
              placeholder="e.g., SW1A 2AA"
            />
          </div>

          {form.coordinates && (
            <div className="flex items-center justify-between gap-2 text-xs text-gray-400 bg-gray-50 p-2.5 rounded-lg">
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin size={13} /> {form.coordinates.lat.toFixed(6)}, {form.coordinates.lng.toFixed(6)}
              </span>
              <button
                type="button"
                onClick={() => setField("coordinates", null)}
                className="font-bold hover:text-gray-600"
              >
                Clear
              </button>
            </div>
          )}

          <TextAreaField
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Add any additional details about the property..."
          />
        </Panel>

        <Panel title="More about the property">
          <div>
            <label className={LABEL}>Transport</label>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-500">
              <select
                className={`${FIELD} w-auto`}
                value={form.transportMinutes}
                onChange={(e) => setField("transportMinutes", e.target.value)}
              >
                {TRANSPORT_MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <span>minutes</span>
              <select
                className={`${FIELD} w-auto`}
                value={form.transportMode}
                onChange={(e) => setField("transportMode", e.target.value)}
              >
                {TRANSPORT_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span>from</span>
              <input
                className={`${FIELD} flex-1 min-w-[12rem]`}
                value={form.transportStation}
                onChange={(e) => setField("transportStation", e.target.value)}
                placeholder="e.g., Green Park"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Living room?</label>
            <YesNo
              value={form.livingRoom}
              onChange={(v) => setField("livingRoom", v)}
              yesLabel="Yes, there is a shared living room"
              noLabel="No"
            />
          </div>

          <div>
            <label className={LABEL}>Amenities</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AMENITIES.map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.amenities.includes(key) ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
                >
                  <input
                    type="checkbox"
                    className="accent-[#F47C3C]"
                    checked={form.amenities.includes(key)}
                    onChange={() => toggleAmenity(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Owner">
          <TextField
            label="Owner Name (optional)"
            value={form.ownerName}
            onChange={(e) => setField("ownerName", e.target.value)}
            placeholder="e.g., John Smith"
          />
        </Panel>

        <Panel title="Photos">
          <div>
            <label className={LABEL}>
              Upload Images {uploading && <Loader2 size={14} className="inline animate-spin ml-2" />}
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

            {form.photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {form.photos.map((src, i) => (
                  <div key={`${src}-${i}`} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    <img src={src} alt={`Property photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
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

        <Panel title="Rental Type">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RENTAL_TYPES.map((t) => {
              const on = t.v === form.rentalType;
              return (
                <button key={t.v} type="button" onClick={() => setField("rentalType", t.v)}
                  className={`text-left p-3 rounded-2xl border transition-all ${on ? "border-[#F47C3C] bg-orange-50 ring-1 ring-[#F47C3C]/30" : "border-gray-100 hover:bg-gray-50"}`}>
                  <p className="font-bold text-sm text-[#0F253B]">{t.v}</p>
                  <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>

          <div>
            <label className={LABEL}>Tenant Type</label>
            <Segmented options={TENANT_TYPES} value={form.tenantType} onChange={(v) => setField("tenantType", v)} />
          </div>

          <div>
            <label className={LABEL}>Status</label>
            <Segmented
              options={["ACTIVE", "DRAFT", "ARCHIVED"]}
              value={form.status}
              onChange={(v) => setField("status", v)}
            />
          </div>
        </Panel>

        <Panel title="Contract">
          {form.rentalType === "HMO" && (
            <p className="text-[11px] font-medium text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 leading-5">
              This is an HMO, which is let room by room — a whole-property agreement usually
              doesn&apos;t apply. Each room&apos;s tenancy is agreed separately.
            </p>
          )}

          <div>
            <label className={LABEL}>Agreement type</label>
            <select className={FIELD} value={form.agreementType} onChange={(e) => setField("agreementType", e.target.value)}>
              {AGREEMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Start date</label>
              <input type="date" className={FIELD} value={form.contractStart} onChange={(e) => setField("contractStart", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>End date</label>
              <input type="date" className={FIELD} value={form.contractEnd} onChange={(e) => setField("contractEnd", e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Rent</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-40">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${FIELD} pl-8`}
                  value={form.contractRent}
                  onChange={(e) => setField("contractRent", e.target.value)}
                  placeholder="1200"
                />
              </div>
              <Segmented
                options={CONTRACT_RENT_PERIODS.map(([v]) => v)}
                value={form.contractRentPeriod}
                onChange={(v) => setField("contractRentPeriod", v)}
                labels={Object.fromEntries(CONTRACT_RENT_PERIODS)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Notice period</label>
              <select className={FIELD} value={form.noticeMonths} onChange={(e) => setField("noticeMonths", Number(e.target.value))}>
                {NOTICE_MONTHS.map((n) => <option key={n} value={n}>{n === 1 ? "1 month" : `${n} months`}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Deposit protection</label>
              <select className={FIELD} value={form.depositScheme} onChange={(e) => setField("depositScheme", e.target.value)}>
                {DEPOSIT_SCHEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Deposit held</label>
            <div className="relative w-40">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${FIELD} pl-8`}
                value={form.depositAmount}
                onChange={(e) => setField("depositAmount", e.target.value)}
                placeholder="1385"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Landlord name"
              value={form.landlordName}
              onChange={(e) => setField("landlordName", e.target.value)}
              placeholder="e.g., John Smith"
            />
            <TextField
              label="Tenant name"
              value={form.tenantName}
              onChange={(e) => setField("tenantName", e.target.value)}
              placeholder="e.g., Aisha Patel"
            />
          </div>

          <label
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${form.rollsToPeriodic ? "border-[#F47C3C] bg-orange-50 text-[#0F253B]" : "border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
          >
            <input
              type="checkbox"
              className="accent-[#F47C3C]"
              checked={form.rollsToPeriodic}
              onChange={(e) => setField("rollsToPeriodic", e.target.checked)}
            />
            Rolls into a periodic tenancy at the end of the fixed term
          </label>

          <TextAreaField
            label="Contract notes (optional)"
            value={form.contractNotes}
            onChange={(e) => setField("contractNotes", e.target.value)}
            placeholder="Break clauses, rent review dates, agreed exceptions..."
          />
        </Panel>

        <Panel title="Inventory">
          <p className="text-[11px] font-medium text-gray-500 leading-5">
            Schedule of condition — what is in the property and what state it is in at check-in,
            so it can be compared at check-out.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Checked on</label>
              <input type="date" className={FIELD} value={form.inventoryCheckedOn} onChange={(e) => setField("inventoryCheckedOn", e.target.value)} />
            </div>
            <TextField
              label="Checked by"
              value={form.inventoryCheckedBy}
              onChange={(e) => setField("inventoryCheckedBy", e.target.value)}
              placeholder="e.g., Sarah Khan"
            />
          </div>

          <datalist id="inventory-locations">
            {INVENTORY_LOCATIONS.map((l) => <option key={l} value={l} />)}
          </datalist>

          {form.inventoryItems.length === 0 ? (
            <p className="text-center text-sm text-gray-400 font-medium border-2 border-dashed border-gray-100 rounded-2xl py-8">
              No items yet — add what the property is let with.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Column headings, wide screens only — each row repeats them on mobile. */}
              <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_4rem_minmax(0,1fr)_6.5rem_minmax(0,2fr)_2rem] gap-2 px-1">
                {["Item", "Location", "Qty", "Condition", "Price", "Notes"].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</span>
                ))}
              </div>

              {form.inventoryItems.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_4rem_minmax(0,1fr)_6.5rem_minmax(0,2fr)_2rem] gap-2 items-center bg-gray-50 md:bg-transparent border border-gray-100 md:border-0 rounded-xl md:rounded-none p-3 md:p-0"
                >
                  <div>
                    <label className={`${LABEL} md:hidden`}>Item</label>
                    <input
                      className={`${FIELD} bg-white`}
                      value={it.item}
                      onChange={(e) => setInventoryItem(i, "item", e.target.value)}
                      placeholder="e.g., Washing machine"
                    />
                  </div>
                  <div>
                    <label className={`${LABEL} md:hidden`}>Location</label>
                    <input
                      className={`${FIELD} bg-white`}
                      list="inventory-locations"
                      value={it.location}
                      onChange={(e) => setInventoryItem(i, "location", e.target.value)}
                      placeholder="Kitchen"
                    />
                  </div>
                  <div>
                    <label className={`${LABEL} md:hidden`}>Qty</label>
                    <input
                      type="number"
                      min="0"
                      className={`${FIELD} bg-white px-2 text-center`}
                      value={it.quantity}
                      onChange={(e) => setInventoryItem(i, "quantity", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={`${LABEL} md:hidden`}>Condition</label>
                    <select
                      className={`${FIELD} bg-white px-2`}
                      value={it.condition}
                      onChange={(e) => setInventoryItem(i, "condition", e.target.value)}
                    >
                      {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`${LABEL} md:hidden`}>Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">£</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${FIELD} bg-white pl-7 pr-2`}
                        value={it.price}
                        onChange={(e) => setInventoryItem(i, "price", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`${LABEL} md:hidden`}>Notes</label>
                    <input
                      className={`${FIELD} bg-white`}
                      value={it.notes}
                      onChange={(e) => setInventoryItem(i, "notes", e.target.value)}
                      placeholder="Small scratch on door"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInventoryItem(i)}
                    title="Remove item"
                    className="justify-self-start md:justify-self-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={addInventoryItem}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-[#0F253B] font-bold text-xs rounded-xl transition-all"
            >
              <Plus size={16} /> Add item
            </button>
            {inventoryTotal(form.inventoryItems) > 0 && (
              <span className="text-[11px] font-bold text-gray-400">
                Total value{" "}
                <span className="text-sm text-[#0F253B] tabular-nums">
                  {formatMoney(inventoryTotal(form.inventoryItems))}
                </span>
              </span>
            )}
          </div>
        </Panel>

        <Panel title="Documents">
          <div>
            <label className={LABEL}>
              Contract &amp; other documents {uploadingDocs && <Loader2 size={14} className="inline animate-spin ml-2" />}
            </label>
            <button
              type="button"
              onClick={() => !uploadingDocs && docInputRef.current?.click()}
              disabled={uploadingDocs}
              className="w-full border-2 border-dashed border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50 rounded-2xl p-6 text-center transition-all disabled:opacity-60"
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2">
                {uploadingDocs ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
              </div>
              <p className="text-sm font-bold text-[#0F253B]">Upload a document</p>
              <p className="text-xs text-gray-400 font-medium">PDF or image, max 15MB each</p>
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleDocuments(e.target.files); e.target.value = ""; }}
              disabled={uploadingDocs}
            />

            <p className="text-[11px] text-gray-400 font-medium mt-2">
              Safety certificates (EPC, EICR, Gas Safety, HMO Licence) are tracked with their
              expiry dates under Compliance.
            </p>

            {form.documents.length > 0 && (
              <div className="mt-3 space-y-2">
                {form.documents.map((doc, i) => (
                  <div key={`${doc.url}-${i}`} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-white text-[#F47C3C] flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm font-bold text-[#0F253B] truncate hover:text-[#F47C3C]"
                      title={doc.name}
                    >
                      {doc.name || docTypeLabel(doc.type)}
                    </a>
                    <select
                      className="px-2.5 py-1.5 bg-white border border-gray-100 rounded-lg text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] shrink-0"
                      value={doc.type || "OTHER"}
                      onChange={(e) => setDocumentType(i, e.target.value)}
                    >
                      {DOCUMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeDocument(i)}
                      title="Remove"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    >
                      <X size={15} />
                    </button>
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
              href={returnHref}
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
              {saving ? "Saving..." : uploading ? "Uploading Images..." : uploadingDocs ? "Uploading Documents..." : isEdit ? "Save Property" : "Create Property"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
