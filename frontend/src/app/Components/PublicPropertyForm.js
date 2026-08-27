"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import api from "@/app/api/api";
import uploadToCloudinary, { uploadFileToCloudinary } from "@/app/utils/uploadToCloudinary";

// ---------------------------------------------------------------------------
// Public "list your property with us" form.
//
// Filled in by a letting agent or landlord who has NO account on the platform,
// for one particular organization (resolved from the slug in the URL). Every
// field mirrors the Property / Room / Owner models so approving the submission
// inside the app is a straight copy — see
// backend/controllers/propertySubmission.controller.js.
// ---------------------------------------------------------------------------

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// --- small presentational pieces -------------------------------------------

function Panel({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
      {title && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 font-medium mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function TextField({ label, hint, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input className={FIELD} {...props} />
      {hint && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{hint}</p>}
    </div>
  );
}

function TextAreaField({ label, hint, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <textarea className={`${FIELD} min-h-[90px] resize-y`} {...props} />
      {hint && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{hint}</p>}
    </div>
  );
}

function MoneyField({ label, hint, ...props }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
          £
        </span>
        <input type="number" min="0" step="0.01" className={`${FIELD} pl-8`} {...props} />
      </div>
      {hint && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{hint}</p>}
    </div>
  );
}

// A row of mutually exclusive pills. `options` is [value, label] pairs.
function Choice({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
            value === v
              ? "bg-[#0F253B] text-white border-[#0F253B]"
              : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// Multi-select pills backed by an array of enum values.
function Chips({ options, values, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => {
        const on = values.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              on
                ? "bg-[#F47C3C] text-white border-[#F47C3C]"
                : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"
            }`}
          >
            {on && <Check size={13} />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 font-medium mt-1.5">{hint}</p>}
    </div>
  );
}

// --- option tables (values must match the backend enums) --------------------

const SUBMITTER_ROLES = [
  ["AGENT", "Letting agent"],
  ["LANDLORD", "Landlord / owner"],
  ["OTHER", "Something else"],
];
const RENTAL_TYPES = [
  ["HMO", "HMO (room by room)"],
  ["SINGLE_LET", "Single let"],
  ["SHORT_TERM", "Short term"],
  ["BLOCK", "Block"],
];
const TENANT_TYPES = [
  ["ANY", "Anyone"],
  ["PROFESSIONAL", "Professionals"],
  ["STUDENT", "Students"],
  ["SOCIAL", "Social housing"],
];
const TRANSPORT_MINUTES = ["0-5", "5-10", "10-15", "15-20", "20-30", "30+"].map((v) => [
  v,
  `${v} min`,
]);
const TRANSPORT_MODES = [
  ["walk", "Walk"],
  ["bus", "Bus"],
  ["train", "Train"],
  ["tube", "Tube"],
  ["tram", "Tram"],
];
const PROPERTY_AMENITIES = [
  ["parking", "Parking"],
  ["garden_patio", "Garden / patio"],
  ["garage", "Garage"],
  ["balcony_terrace", "Balcony / roof terrace"],
  ["disabled_access", "Disabled access"],
];
const AGREEMENT_TYPES = [
  ["AST", "Assured Shorthold Tenancy"],
  ["COMPANY_LET", "Company let"],
  ["LICENCE", "Licence to occupy"],
  ["LODGER", "Lodger agreement"],
  ["OTHER", "Other"],
];
const RENT_PERIODS = [
  ["MONTHLY", "per calendar month"],
  ["WEEKLY", "per week"],
];
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
const YES_NO = [
  [true, "Yes"],
  [false, "No"],
];
const ROOM_TYPES = [
  ["STANDARD", "Standard"],
  ["ENSUITE", "Ensuite"],
  ["STUDIO", "Studio"],
  ["MASTER", "Master"],
  ["DOUBLE", "Double"],
  ["SINGLE", "Single"],
];
const OCCUPANCIES = [
  ["SINGLE", "Single"],
  ["DOUBLE", "Double"],
  ["TWIN", "Twin"],
  ["FAMILY", "Family"],
];
const BATHROOM_TYPES = [
  ["shared", "Shared"],
  ["private", "Private"],
];
const BILLS_OPTIONS = [
  ["YES", "All included"],
  ["SOME", "Some included"],
  ["NO", "None included"],
];
const BILL_KEYS = [
  ["electricity", "Electricity"],
  ["gas", "Gas"],
  ["water", "Water"],
  ["wifi", "Wifi"],
  ["internet", "Internet"],
  ["councilTax", "Council tax"],
];
const ROOM_STATUSES = [
  ["AVAILABLE", "Available"],
  ["AVAILABLE_SOON", "Available soon"],
  ["RESERVED", "Reserved"],
  ["OCCUPIED", "Occupied"],
  ["MAINTENANCE", "Maintenance"],
];
const DAYS_AVAILABLE = [
  ["SEVEN_DAYS", "7 days a week"],
  ["WEEKDAYS", "Monday to Friday"],
  ["WEEKENDS", "Weekends only"],
];
const ROOM_AMENITIES = [
  ["single_bed", "Single bed"],
  ["double_bed", "Double bed"],
  ["desk", "Desk"],
  ["chair", "Chair"],
  ["wardrobe", "Wardrobe"],
  ["chest_of_drawers", "Chest of drawers"],
  ["mirror", "Mirror"],
  ["tv", "TV"],
  ["balcony", "Balcony"],
  ["ensuite_bathroom", "Ensuite bathroom"],
  ["lockable_room", "Lockable room"],
];
const SHARED_AMENITIES = [
  ["wifi", "Wifi"],
  ["washing_machine", "Washing machine"],
  ["dryer", "Dryer"],
  ["dishwasher", "Dishwasher"],
  ["shared_kitchen", "Shared kitchen"],
  ["parking", "Parking"],
  ["garden", "Garden"],
  ["lift", "Lift"],
  ["gym", "Gym"],
  ["security", "Security"],
  ["cctv", "CCTV"],
  ["cleaning_service", "Cleaning service"],
  ["bike_storage", "Bike storage"],
];
const SMOKING = [
  ["NO_PREFERENCE", "No preference"],
  ["YES", "Yes"],
  ["NO", "No"],
];
const GENDERS = [
  ["ANY", "Don't mind"],
  ["MALE", "Male"],
  ["FEMALE", "Female"],
];
const OCCUPATIONS = [
  ["ALL", "Available to all"],
  ["STUDENTS_ONLY", "Students only"],
  ["NO_STUDENTS", "Not suitable for students"],
];
const PETS = [
  ["NO", "No"],
  ["YES", "Yes"],
  ["NO_PREFERENCE", "No preference"],
];
const CONDITIONS = [
  ["NEW", "New"],
  ["GOOD", "Good"],
  ["FAIR", "Fair"],
  ["POOR", "Poor"],
];

const labelOf = (options, value) =>
  options.find(([v]) => v === value)?.[1] ?? String(value ?? "—");

// --- empty shapes -----------------------------------------------------------

const BLANK_ROOM = {
  roomName: "",
  roomNumber: "",
  description: "",
  roomType: "STANDARD",
  occupancy: "SINGLE",
  furnished: true,
  floor: "",
  roomSize: "",
  bathroomType: "shared",
  monthlyRent: "",
  rentPeriod: "MONTHLY",
  securityDeposit: "",
  holdingDeposit: "",
  billsOption: "SOME",
  billsIncluded: {
    electricity: false,
    gas: false,
    water: false,
    wifi: false,
    internet: false,
    councilTax: false,
  },
  status: "AVAILABLE",
  availableFrom: "",
  minimumTenancy: 6,
  maximumTenancy: "",
  shortTermLets: false,
  daysAvailable: "SEVEN_DAYS",
  referencesRequired: null,
  roomAmenities: [],
  propertyAmenities: [],
  wifiSpeed: "",
  images: [],
  prefSmoking: "NO_PREFERENCE",
  prefGender: "ANY",
  prefOccupation: "ALL",
  prefPets: "NO",
  prefCouplesWelcome: false,
  notes: "",
};

const BLANK_INVENTORY_ITEM = {
  item: "",
  location: "",
  quantity: 1,
  condition: "GOOD",
  price: "",
  notes: "",
};

const EMPTY = {
  // Step 1 — who is submitting
  submitterRole: "AGENT",
  submitterName: "",
  submitterCompany: "",
  submitterEmail: "",
  submitterPhone: "",
  // Step 2 — owner / landlord
  ownerName: "",
  ownerIsCompany: false,
  ownerEmail: "",
  ownerPhone: "",
  ownerBankAccount: "",
  ownerNotes: "",
  // Step 3 — the property
  name: "",
  rentalType: "HMO",
  tenantType: "ANY",
  address: "",
  addressLine2: "",
  area: "",
  city: "",
  county: "",
  postcode: "",
  coordinates: null,
  description: "",
  // Step 4 — features
  transportMinutes: "0-5",
  transportMode: "walk",
  transportStation: "",
  livingRoom: null,
  amenities: [],
  // Step 5 — media
  photos: [],
  documents: [],
  // Step 6 — rooms
  rooms: [],
  // Step 7 — contract & inventory
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
  inventoryCheckedOn: "",
  inventoryCheckedBy: "",
  inventoryItems: [],
  // Step 8
  message: "",
};

const STEPS = [
  { key: "you", title: "Your details" },
  { key: "owner", title: "Owner" },
  { key: "property", title: "Property" },
  { key: "features", title: "Features" },
  { key: "media", title: "Photos" },
  { key: "rooms", title: "Rooms" },
  { key: "contract", title: "Contract" },
  { key: "review", title: "Review" },
];

const DRAFT_VERSION = 1;
const draftKey = (slug) => `pms:property-submission-draft:${slug}`;

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const num = (value) => (value === "" || value === null ? null : Number(value));

/**
 * @param {object}  props
 * @param {string}  props.slug         organization slug from the URL
 * @param {object}  props.organization { name, logo, type } from /public/organizations/:slug
 */
export default function PublicPropertyForm({ slug, organization }) {
  const [form, setForm] = useState(EMPTY);
  const setField = useCallback(
    (key, value) => setForm((f) => ({ ...f, [key]: value })),
    []
  );

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");

  const [restored, setRestored] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const submittedRef = useRef(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const skipSuggestRef = useRef(true);
  const addressBoxRef = useRef(null);

  // Uploads
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const photoInputRef = useRef(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const docInputRef = useRef(null);

  const storageKey = draftKey(slug);

  // --- draft restore --------------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.v === DRAFT_VERSION && parsed.data) {
          setForm({ ...EMPTY, ...parsed.data });
          setRestoredNotice(true);
        }
      }
    } catch (err) {
      console.error("Could not read submission draft:", err);
    }
    setRestored(true);
  }, [storageKey]);

  // --- draft autosave (debounced) ------------------------------------------
  useEffect(() => {
    if (!restored || submittedRef.current) return;

    const timeoutId = setTimeout(() => {
      try {
        if (JSON.stringify(form) === JSON.stringify(EMPTY)) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ v: DRAFT_VERSION, savedAt: Date.now(), data: form })
          );
        }
      } catch (err) {
        console.error("Could not save submission draft:", err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form, restored, storageKey]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* quota / private mode */
    }
    setForm(EMPTY);
    setRestoredNotice(false);
    setSuggestions([]);
    setError("");
    setStep(0);
    skipSuggestRef.current = true;
  };

  // --- address autocomplete -------------------------------------------------
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
    if (!key) return; // typing the address by hand still works

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
          `https://api.locationiq.com/v1/autocomplete?key=${key}&q=${encodeURIComponent(
            query
          )}&limit=5&countrycodes=gb&format=json`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Location search failed");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoadingLocation(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [form.address]);

  useEffect(() => {
    if (suggestions.length === 0) return;
    const onDown = (e) => {
      if (addressBoxRef.current && !addressBoxRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestions.length]);

  const handleAddressSelect = async (suggestion) => {
    const selected = suggestion.display_name || suggestion.address?.name || "";
    skipSuggestRef.current = true;
    setSuggestions([]);

    const a = suggestion.address || {};
    setForm((f) => ({
      ...f,
      address: selected,
      name: f.name || selected,
      area: a.suburb || a.neighbourhood || a.city_district || f.area,
      city: a.city || a.town || a.village || f.city,
      county: a.county || f.county,
      postcode: a.postcode || f.postcode,
      coordinates:
        suggestion.lat && suggestion.lon
          ? { lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) }
          : f.coordinates,
    }));
  };

  // --- photos ---------------------------------------------------------------
  const handlePhotos = async (fileList) => {
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

  const removePhoto = (index) =>
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== index) }));

  // The first photo is the cover, so "make cover" just moves it to the front.
  const makeCover = (index) =>
    setForm((f) => ({
      ...f,
      photos: [f.photos[index], ...f.photos.filter((_, i) => i !== index)],
    }));

  // --- documents ------------------------------------------------------------
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
        uploaded.push({ name: result.name, url: result.url, type: "OTHER" });
      } catch (err) {
        failures.push(`${file.name}: ${err.message || "upload failed"}`);
      }
    }

    if (uploaded.length > 0)
      setForm((f) => ({ ...f, documents: [...f.documents, ...uploaded] }));
    if (failures.length > 0) setError(failures.join(" · "));
    setUploadingDocs(false);
  };

  const setDocumentType = (index, type) =>
    setForm((f) => ({
      ...f,
      documents: f.documents.map((d, i) => (i === index ? { ...d, type } : d)),
    }));

  const removeDocument = (index) =>
    setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== index) }));

  // --- rooms ----------------------------------------------------------------
  const addRoom = () =>
    setForm((f) => ({
      ...f,
      rooms: [
        ...f.rooms,
        { ...BLANK_ROOM, roomName: `Room ${f.rooms.length + 1}` },
      ],
    }));

  const setRoomField = (index, key, value) =>
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    }));

  const removeRoom = (index) =>
    setForm((f) => ({ ...f, rooms: f.rooms.filter((_, i) => i !== index) }));

  // --- inventory ------------------------------------------------------------
  const addInventoryItem = () =>
    setForm((f) => ({
      ...f,
      inventoryItems: [...f.inventoryItems, { ...BLANK_INVENTORY_ITEM }],
    }));

  const setInventoryItem = (index, key, value) =>
    setForm((f) => ({
      ...f,
      inventoryItems: f.inventoryItems.map((it, i) =>
        i === index ? { ...it, [key]: value } : it
      ),
    }));

  const removeInventoryItem = (index) =>
    setForm((f) => ({
      ...f,
      inventoryItems: f.inventoryItems.filter((_, i) => i !== index),
    }));

  const toggleAmenity = (key) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter((a) => a !== key)
        : [...f.amenities, key],
    }));

  // --- step validation ------------------------------------------------------
  // Each step is checked on the way forward only, so someone can jump back to
  // fix an earlier answer without being blocked by a later one.
  const validateStep = (index) => {
    switch (STEPS[index].key) {
      case "you":
        if (!form.submitterName.trim()) return "Please tell us your name.";
        if (!isEmail(form.submitterEmail.trim()))
          return "Please enter a valid email address.";
        return "";
      case "property":
        if (!form.name.trim()) return "The property needs a name.";
        if (!form.address.trim()) return "The property address is required.";
        return "";
      case "rooms": {
        const bad = form.rooms.findIndex(
          (r) => !r.roomName.trim() || r.monthlyRent === "" || Number(r.monthlyRent) < 0
        );
        if (bad !== -1)
          return `Room ${bad + 1} needs a name and a rent — remove it if you don't have the details yet.`;
        return "";
      }
      case "contract":
        if (
          form.contractStart &&
          form.contractEnd &&
          form.contractEnd < form.contractStart
        )
          return "The contract end date cannot be before the start date.";
        return "";
      default:
        return "";
    }
  };

  const goNext = () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- submit ---------------------------------------------------------------
  const submit = async () => {
    // Re-run every step's checks — someone can reach Review by jumping back and
    // forth, and the earlier steps are the ones the backend rejects.
    for (let i = 0; i < STEPS.length; i++) {
      const message = validateStep(i);
      if (message) {
        setError(message);
        setStep(i);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setSubmitting(true);
    setError("");

    const payload = {
      submittedBy: {
        role: form.submitterRole,
        name: form.submitterName.trim(),
        company: form.submitterCompany.trim(),
        email: form.submitterEmail.trim(),
        phone: form.submitterPhone.trim(),
      },
      owner: {
        name: form.ownerName.trim(),
        company: form.ownerIsCompany,
        email: form.ownerEmail.trim(),
        phone: form.ownerPhone.trim(),
        bank: { account: form.ownerBankAccount.trim() },
        notes: form.ownerNotes.trim(),
      },
      property: {
        name: form.name.trim(),
        rentalType: form.rentalType,
        tenantType: form.tenantType,
        ownerName: form.ownerName.trim(),
        address: {
          line1: form.address.trim(),
          line2: form.addressLine2.trim(),
          area: form.area.trim(),
          city: form.city.trim(),
          county: form.county.trim(),
          postcode: form.postcode.trim(),
          country: "United Kingdom",
        },
        ...(form.coordinates ? { location: form.coordinates } : {}),
        description: form.description.trim(),
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
          rentAmount: num(form.contractRent),
          rentPeriod: form.contractRentPeriod,
          noticeMonths: Number(form.noticeMonths) || 1,
          depositScheme: form.depositScheme,
          depositAmount: num(form.depositAmount),
          landlordName: form.landlordName.trim() || form.ownerName.trim(),
          tenantName: form.tenantName.trim(),
          rollsToPeriodic: form.rollsToPeriodic,
          notes: form.contractNotes.trim(),
        },
        inventory: {
          checkedOn: form.inventoryCheckedOn || null,
          checkedBy: form.inventoryCheckedBy.trim(),
          items: form.inventoryItems
            .filter((it) => it.item.trim())
            .map((it) => ({
              item: it.item.trim(),
              location: it.location.trim(),
              quantity: Number(it.quantity) || 1,
              condition: it.condition,
              price: num(it.price),
              notes: it.notes.trim(),
            })),
        },
        documents: form.documents,
        coverImage: form.photos[0] || "",
        gallery: form.photos.slice(1),
      },
      rooms: form.rooms.map((r) => ({
        roomName: r.roomName.trim(),
        title: r.roomName.trim(),
        roomNumber: r.roomNumber.trim(),
        description: r.description.trim(),
        roomType: r.roomType,
        occupancy: r.occupancy,
        furnished: r.furnished,
        floor: r.floor.trim(),
        roomSize: r.roomSize.trim(),
        bathroomType: r.bathroomType,
        monthlyRent: Number(r.monthlyRent),
        rentPeriod: r.rentPeriod,
        securityDeposit: num(r.securityDeposit),
        holdingDeposit: num(r.holdingDeposit),
        billsOption: r.billsOption,
        // YES / NO set every flag one way; SOME defers to the checkboxes.
        billsIncluded:
          r.billsOption === "SOME"
            ? r.billsIncluded
            : Object.fromEntries(
                BILL_KEYS.map(([k]) => [k, r.billsOption === "YES"])
              ),
        status: r.status,
        availableFrom: r.availableFrom || null,
        minimumTenancy: Number(r.minimumTenancy) || 6,
        maximumTenancy: num(r.maximumTenancy),
        shortTermLets: r.shortTermLets,
        daysAvailable: r.daysAvailable,
        referencesRequired: r.referencesRequired,
        roomAmenities: r.roomAmenities,
        propertyAmenities: r.propertyAmenities,
        wifiSpeed: r.wifiSpeed.trim(),
        images: r.images.map((url) => ({ url, alt: r.roomName.trim() })),
        preferences: {
          smoking: r.prefSmoking,
          gender: r.prefGender,
          occupation: r.prefOccupation,
          pets: r.prefPets,
          couplesWelcome: r.prefCouplesWelcome,
        },
        notes: r.notes.trim(),
      })),
      message: form.message.trim(),
    };

    try {
      const res = await api.post(
        `/public/organizations/${encodeURIComponent(slug)}/properties`,
        payload
      );
      submittedRef.current = true;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* quota / private mode */
      }
      setReference(res.data?.data?.propertyCode || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "We could not send your property. Please try again."
      );
      setSubmitting(false);
    }
  };

  // --- success --------------------------------------------------------------
  if (reference) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0F253B]">Property added</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            It is live on {organization?.name || "the agency"}&apos;s books now.
            They have your details at{" "}
            <span className="text-[#0F253B]">{form.submitterEmail}</span> if
            anything needs checking.
          </p>
        </div>
        <div className="inline-flex flex-col items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Property reference
          </p>
          <p className="text-lg font-bold text-[#0F253B]">{reference}</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setReference("");
              submittedRef.current = false;
              setForm({
                ...EMPTY,
                // Keep the submitter's own details — agents send several in a row.
                submitterRole: form.submitterRole,
                submitterName: form.submitterName,
                submitterCompany: form.submitterCompany,
                submitterEmail: form.submitterEmail,
                submitterPhone: form.submitterPhone,
              });
              setStep(2);
            }}
            className="text-sm font-bold text-[#F47C3C] hover:text-[#0F253B]"
          >
            Submit another property
          </button>
        </div>
      </div>
    );
  }

  const busy = submitting || uploading || uploadingDocs;
  const current = STEPS[step].key;

  return (
    <div className="space-y-5">
      {/* progress */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#0F253B]">
            Step {step + 1} of {STEPS.length} · {STEPS[step].title}
          </p>
          <p className="text-[11px] font-bold text-gray-400">
            {Math.round(((step + 1) / STEPS.length) * 100)}%
          </p>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F47C3C] rounded-full transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              // Only steps already visited are clickable, so nobody skips the
              // required first step by jumping straight to Review.
              disabled={i > step}
              onClick={() => setStep(i)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                i === step
                  ? "bg-[#0F253B] text-white"
                  : i < step
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {restoredNotice && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-blue-800">
            We restored the property you started earlier.
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (current === "review") submit();
          else goNext();
        }}
        className="space-y-5"
      >
        {/* ---------------------------------------------------------------- */}
        {current === "you" && (
          <Panel
            title="Your details"
            subtitle="So we know who to come back to about this property."
          >
            <Field label="You are">
              <Choice
                options={SUBMITTER_ROLES}
                value={form.submitterRole}
                onChange={(v) => setField("submitterRole", v)}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Full name *"
                value={form.submitterName}
                onChange={(e) => setField("submitterName", e.target.value)}
                placeholder="e.g., Sarah Ahmed"
                required
              />
              <TextField
                label="Company"
                value={form.submitterCompany}
                onChange={(e) => setField("submitterCompany", e.target.value)}
                placeholder="e.g., Melrose Lettings"
              />
              <TextField
                label="Email *"
                type="email"
                value={form.submitterEmail}
                onChange={(e) => setField("submitterEmail", e.target.value)}
                placeholder="you@agency.co.uk"
                required
              />
              <TextField
                label="Phone"
                value={form.submitterPhone}
                onChange={(e) => setField("submitterPhone", e.target.value)}
                placeholder="07700 900123"
              />
            </div>
          </Panel>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "owner" && (
          <Panel
            title="Owner / landlord"
            subtitle="Who owns the property. Leave blank if you are the owner and already told us above."
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Owner name"
                value={form.ownerName}
                onChange={(e) => setField("ownerName", e.target.value)}
                placeholder="e.g., John Whitfield"
              />
              <Field label="Owner is a company">
                <Choice
                  options={YES_NO}
                  value={form.ownerIsCompany}
                  onChange={(v) => setField("ownerIsCompany", v)}
                />
              </Field>
              <TextField
                label="Owner email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setField("ownerEmail", e.target.value)}
                placeholder="owner@example.com"
              />
              <TextField
                label="Owner phone"
                value={form.ownerPhone}
                onChange={(e) => setField("ownerPhone", e.target.value)}
                placeholder="07700 900456"
              />
            </div>
            <TextField
              label="Payout account"
              value={form.ownerBankAccount}
              onChange={(e) => setField("ownerBankAccount", e.target.value)}
              placeholder="Bank account rent is paid into"
              hint="Optional — you can share this later once the property is onboarded."
            />
            <TextAreaField
              label="Notes about the owner"
              value={form.ownerNotes}
              onChange={(e) => setField("ownerNotes", e.target.value)}
              placeholder="Preferred contact times, management expectations, anything useful."
            />
          </Panel>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "property" && (
          <Panel title="The property" subtitle="Where it is and how it is let.">
            <TextField
              label="Property name *"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g., Melrose House"
              required
            />

            <div className="relative" ref={addressBoxRef}>
              <label className={LABEL}>Address *</label>
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
                  {loadingLocation && suggestions.length === 0 && (
                    <p className="px-4 py-3 text-xs font-medium text-gray-400">
                      Searching…
                    </p>
                  )}
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleAddressSelect(suggestion)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
                    >
                      <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-[#0F253B]">
                          {suggestion.address?.name ||
                            suggestion.display_name?.split(",")[0] ||
                            "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {suggestion.address?.city ||
                            suggestion.address?.town ||
                            suggestion.address?.village ||
                            ""}
                          {suggestion.address?.postcode &&
                            `, ${suggestion.address.postcode}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Address line 2"
                value={form.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                placeholder="Flat, building, floor"
              />
              <TextField
                label="Area"
                value={form.area}
                onChange={(e) => setField("area", e.target.value)}
                placeholder="e.g., Jesmond"
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="e.g., Newcastle"
              />
              <TextField
                label="County"
                value={form.county}
                onChange={(e) => setField("county", e.target.value)}
                placeholder="e.g., Tyne and Wear"
              />
              <TextField
                label="Postcode"
                value={form.postcode}
                onChange={(e) => setField("postcode", e.target.value)}
                placeholder="e.g., NE2 1AA"
              />
            </div>

            <Field
              label="Rental type"
              hint="An HMO is let room by room — add each room on the Rooms step."
            >
              <Choice
                options={RENTAL_TYPES}
                value={form.rentalType}
                onChange={(v) => setField("rentalType", v)}
              />
            </Field>

            <Field label="Suitable for">
              <Choice
                options={TENANT_TYPES}
                value={form.tenantType}
                onChange={(v) => setField("tenantType", v)}
              />
            </Field>

            <TextAreaField
              label="Description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Describe the property, the area, and anything a tenant should know."
            />
          </Panel>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "features" && (
          <>
            <Panel title="Transport" subtitle="The nearest link, and how long it takes.">
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField
                  label="Station / stop"
                  value={form.transportStation}
                  onChange={(e) => setField("transportStation", e.target.value)}
                  placeholder="e.g., Jesmond Metro"
                  hint="Leave blank to skip transport altogether."
                />
                <Field label="How far">
                  <Choice
                    options={TRANSPORT_MINUTES}
                    value={form.transportMinutes}
                    onChange={(v) => setField("transportMinutes", v)}
                  />
                </Field>
              </div>
              <Field label="By">
                <Choice
                  options={TRANSPORT_MODES}
                  value={form.transportMode}
                  onChange={(v) => setField("transportMode", v)}
                />
              </Field>
            </Panel>

            <Panel title="Amenities" subtitle="What the property has.">
              <Field label="Shared living room">
                <Choice
                  options={YES_NO}
                  value={form.livingRoom}
                  onChange={(v) => setField("livingRoom", v)}
                />
              </Field>
              <Field label="Property amenities">
                <Chips
                  options={PROPERTY_AMENITIES}
                  values={form.amenities}
                  onToggle={toggleAmenity}
                />
              </Field>
            </Panel>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "media" && (
          <>
            <Panel
              title="Photos"
              subtitle="The first photo becomes the cover image on the listing."
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handlePhotos(e.dataTransfer.files);
                }}
                onClick={() => photoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragging
                    ? "border-[#F47C3C] bg-orange-50"
                    : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"
                }`}
              >
                {uploading ? (
                  <Loader2 size={28} className="mx-auto text-[#F47C3C] animate-spin" />
                ) : (
                  <UploadCloud size={28} className="mx-auto text-gray-300" />
                )}
                <p className="text-sm font-bold text-[#0F253B] mt-2">
                  {uploading ? "Uploading…" : "Drop photos here or click to browse"}
                </p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  JPG or PNG, up to 10MB each
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    handlePhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {form.photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {form.photos.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="relative group rounded-xl overflow-hidden border border-gray-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-28 object-cover"
                      />
                      {index === 0 && (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-[#F47C3C] text-white text-[10px] font-bold">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => makeCover(index)}
                            title="Make cover"
                            className="w-8 h-8 rounded-lg bg-white text-[#0F253B] flex items-center justify-center"
                          >
                            <Star size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          title="Remove"
                          className="w-8 h-8 rounded-lg bg-white text-red-600 flex items-center justify-center"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Documents"
              subtitle="Contract, floor plan, insurance, licence — anything you already have."
            >
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50 rounded-2xl p-6 text-center transition-all"
              >
                {uploadingDocs ? (
                  <Loader2 size={24} className="mx-auto text-[#F47C3C] animate-spin" />
                ) : (
                  <FileText size={24} className="mx-auto text-gray-300" />
                )}
                <p className="text-sm font-bold text-[#0F253B] mt-2">
                  {uploadingDocs ? "Uploading…" : "Upload documents"}
                </p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">
                  PDF, Word or image, up to 15MB each
                </p>
              </button>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                multiple
                hidden
                onChange={(e) => {
                  handleDocuments(e.target.files);
                  e.target.value = "";
                }}
              />

              {form.documents.length > 0 && (
                <div className="space-y-2">
                  {form.documents.map((doc, index) => (
                    <div
                      key={`${doc.url}-${index}`}
                      className="flex items-center gap-3 flex-wrap bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5"
                    >
                      <FileText size={16} className="text-gray-400 shrink-0" />
                      <p className="text-xs font-bold text-[#0F253B] flex-1 truncate min-w-[120px]">
                        {doc.name}
                      </p>
                      <div className="relative">
                        <select
                          value={doc.type}
                          onChange={(e) => setDocumentType(index, e.target.value)}
                          className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-white border border-gray-100 text-[11px] font-bold text-[#0F253B] outline-none"
                        >
                          {DOCUMENT_TYPES.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "rooms" && (
          <>
            <Panel
              title="Rooms"
              subtitle={
                form.rentalType === "HMO"
                  ? "An HMO is advertised room by room — add every room you are letting."
                  : "Optional for a whole-property let, but useful if you want each room listed."
              }
            >
              {form.rooms.length === 0 && (
                <p className="text-xs text-gray-400 font-medium">
                  No rooms added yet.
                </p>
              )}

              <button
                type="button"
                onClick={addRoom}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] text-white text-xs font-bold rounded-xl hover:bg-[#183a5a] transition-all"
              >
                <Plus size={15} /> Add a room
              </button>
            </Panel>

            {form.rooms.map((room, index) => (
              <RoomEditor
                key={index}
                index={index}
                room={room}
                onChange={setRoomField}
                onRemove={() => removeRoom(index)}
                onError={setError}
              />
            ))}
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "contract" && (
          <>
            <Panel
              title="Contract"
              subtitle="The agreement for the property as a whole. Skip it for an HMO — those are agreed room by room."
            >
              <Field label="Agreement type">
                <Choice
                  options={AGREEMENT_TYPES}
                  value={form.agreementType}
                  onChange={(v) => setField("agreementType", v)}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField
                  label="Start date"
                  type="date"
                  value={form.contractStart}
                  onChange={(e) => setField("contractStart", e.target.value)}
                />
                <TextField
                  label="End date"
                  type="date"
                  value={form.contractEnd}
                  onChange={(e) => setField("contractEnd", e.target.value)}
                />
                <MoneyField
                  label="Rent"
                  value={form.contractRent}
                  onChange={(e) => setField("contractRent", e.target.value)}
                  placeholder="0.00"
                />
                <Field label="Rent period">
                  <Choice
                    options={RENT_PERIODS}
                    value={form.contractRentPeriod}
                    onChange={(v) => setField("contractRentPeriod", v)}
                  />
                </Field>
                <TextField
                  label="Notice (months)"
                  type="number"
                  min="1"
                  max="12"
                  value={form.noticeMonths}
                  onChange={(e) => setField("noticeMonths", e.target.value)}
                />
                <MoneyField
                  label="Deposit"
                  value={form.depositAmount}
                  onChange={(e) => setField("depositAmount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Field label="Deposit scheme">
                <Choice
                  options={DEPOSIT_SCHEMES}
                  value={form.depositScheme}
                  onChange={(v) => setField("depositScheme", v)}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField
                  label="Landlord on the agreement"
                  value={form.landlordName}
                  onChange={(e) => setField("landlordName", e.target.value)}
                  placeholder="Defaults to the owner name"
                />
                <TextField
                  label="Tenant on the agreement"
                  value={form.tenantName}
                  onChange={(e) => setField("tenantName", e.target.value)}
                  placeholder="If the property is already let"
                />
              </div>
              <Field label="Rolls into a periodic tenancy at the end">
                <Choice
                  options={YES_NO}
                  value={form.rollsToPeriodic}
                  onChange={(v) => setField("rollsToPeriodic", v)}
                />
              </Field>
              <TextAreaField
                label="Contract notes"
                value={form.contractNotes}
                onChange={(e) => setField("contractNotes", e.target.value)}
                placeholder="Break clauses, guarantors, anything unusual."
              />
            </Panel>

            <Panel
              title="Inventory"
              subtitle="What is in the property and the state it is in — the schedule of condition at check-in."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <TextField
                  label="Checked on"
                  type="date"
                  value={form.inventoryCheckedOn}
                  onChange={(e) => setField("inventoryCheckedOn", e.target.value)}
                />
                <TextField
                  label="Checked by"
                  value={form.inventoryCheckedBy}
                  onChange={(e) => setField("inventoryCheckedBy", e.target.value)}
                  placeholder="Who did the inventory"
                />
              </div>

              {form.inventoryItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      Item {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeInventoryItem(index)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TextField
                      label="Item"
                      value={item.item}
                      onChange={(e) => setInventoryItem(index, "item", e.target.value)}
                      placeholder="e.g., Sofa"
                    />
                    <TextField
                      label="Location"
                      value={item.location}
                      onChange={(e) =>
                        setInventoryItem(index, "location", e.target.value)
                      }
                      placeholder="e.g., Living room"
                    />
                    <TextField
                      label="Quantity"
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) =>
                        setInventoryItem(index, "quantity", e.target.value)
                      }
                    />
                    <MoneyField
                      label="Replacement value"
                      value={item.price}
                      onChange={(e) => setInventoryItem(index, "price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Field label="Condition">
                    <Choice
                      options={CONDITIONS}
                      value={item.condition}
                      onChange={(v) => setInventoryItem(index, "condition", v)}
                    />
                  </Field>
                </div>
              ))}

              <button
                type="button"
                onClick={addInventoryItem}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-100 hover:bg-gray-100 text-[#0F253B] text-xs font-bold rounded-xl transition-all"
              >
                <Plus size={15} /> Add an inventory item
              </button>
            </Panel>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {current === "review" && (
          <>
            <Panel title="Review" subtitle="Check it over before sending.">
              <Summary label="Submitted by">
                {form.submitterName}
                {form.submitterCompany ? ` · ${form.submitterCompany}` : ""} ·{" "}
                {labelOf(SUBMITTER_ROLES, form.submitterRole)}
                <br />
                {form.submitterEmail}
                {form.submitterPhone ? ` · ${form.submitterPhone}` : ""}
              </Summary>

              <Summary label="Owner">
                {form.ownerName ? (
                  <>
                    {form.ownerName}
                    {form.ownerIsCompany ? " (company)" : ""}
                    {form.ownerEmail ? ` · ${form.ownerEmail}` : ""}
                    {form.ownerPhone ? ` · ${form.ownerPhone}` : ""}
                  </>
                ) : (
                  "Not provided"
                )}
              </Summary>

              <Summary label="Property">
                {form.name}
                <br />
                {[form.address, form.area, form.city, form.postcode]
                  .filter(Boolean)
                  .join(", ")}
                <br />
                {labelOf(RENTAL_TYPES, form.rentalType)} ·{" "}
                {labelOf(TENANT_TYPES, form.tenantType)}
              </Summary>

              <Summary label="Features">
                {form.transportStation
                  ? `${form.transportMinutes} min ${form.transportMode} from ${form.transportStation}`
                  : "No transport link given"}
                <br />
                Living room:{" "}
                {form.livingRoom === null ? "not answered" : form.livingRoom ? "yes" : "no"}
                <br />
                {form.amenities.length
                  ? form.amenities.map((a) => labelOf(PROPERTY_AMENITIES, a)).join(", ")
                  : "No amenities selected"}
              </Summary>

              <Summary label="Media">
                {form.photos.length} photo{form.photos.length === 1 ? "" : "s"} ·{" "}
                {form.documents.length} document
                {form.documents.length === 1 ? "" : "s"}
              </Summary>

              <Summary label="Rooms">
                {form.rooms.length === 0
                  ? "No rooms added"
                  : form.rooms
                      .map(
                        (r) =>
                          `${r.roomName} (£${r.monthlyRent || 0} ${
                            r.rentPeriod === "WEEKLY" ? "pw" : "pcm"
                          })`
                      )
                      .join(", ")}
              </Summary>

              <Summary label="Contract">
                {labelOf(AGREEMENT_TYPES, form.agreementType)}
                {form.contractStart ? ` · from ${form.contractStart}` : ""}
                {form.contractEnd ? ` to ${form.contractEnd}` : ""}
                {form.contractRent
                  ? ` · £${form.contractRent} ${
                      form.contractRentPeriod === "WEEKLY" ? "pw" : "pcm"
                    }`
                  : ""}
              </Summary>
            </Panel>

            <Panel title="Anything else" subtitle="Access notes, timings, tenants in situ.">
              <TextAreaField
                label="Message"
                value={form.message}
                onChange={(e) => setField("message", e.target.value)}
                placeholder="Tell us anything that doesn't fit the fields above."
              />
              <p className="text-[11px] text-gray-400 font-medium">
                By submitting you confirm you are authorised to market this property and
                that {organization?.name || "the agency"} may contact you about it.
              </p>
            </Panel>
          </>
        )}

        {/* nav */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || busy}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
          >
            <ArrowLeft size={17} /> Back
          </button>

          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 px-6 py-3 bg-[#F47C3C] hover:bg-[#e06a2b] text-white font-bold text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Sending…
              </>
            ) : current === "review" ? (
              <>
                <Check size={17} /> Submit property
              </>
            ) : (
              <>
                Continue <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Summary({ label, children }) {
  return (
    <div className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
        {label}
      </p>
      <p className="text-sm font-medium text-[#0F253B] leading-relaxed">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One room. Collapsed to a summary row until opened, so a 12-bed HMO does not
// turn the page into an endless scroll.
// ---------------------------------------------------------------------------
function RoomEditor({ index, room, onChange, onRemove, onError }) {
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const set = (key, value) => onChange(index, key, value);

  const toggleIn = (key, value) =>
    set(
      key,
      room[key].includes(value)
        ? room[key].filter((v) => v !== value)
        : [...room[key], value]
    );

  const handleImages = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    setUploading(true);
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

    if (urls.length > 0) set("images", [...room.images, ...urls]);
    if (failures.length > 0) onError(failures.join(" · "));
    setUploading(false);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0">
          <Bed size={17} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-sm font-bold text-[#0F253B] truncate">
            {room.roomName || `Room ${index + 1}`}
          </p>
          <p className="text-[11px] text-gray-400 font-medium">
            {labelOf(ROOM_TYPES, room.roomType)} ·{" "}
            {room.monthlyRent ? `£${room.monthlyRent}` : "no rent yet"}{" "}
            {room.rentPeriod === "WEEKLY" ? "pw" : "pcm"} · {room.images.length} photo
            {room.images.length === 1 ? "" : "s"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-gray-400 hover:text-[#0F253B]"
        >
          <ChevronDown
            size={18}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600"
          title="Remove room"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-5 space-y-4 border-t border-gray-50 pt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField
              label="Room name *"
              value={room.roomName}
              onChange={(e) => set("roomName", e.target.value)}
              placeholder="e.g., Room 1"
            />
            <TextField
              label="Room number"
              value={room.roomNumber}
              onChange={(e) => set("roomNumber", e.target.value)}
              placeholder="e.g., 1A"
            />
            <MoneyField
              label="Rent *"
              value={room.monthlyRent}
              onChange={(e) => set("monthlyRent", e.target.value)}
              placeholder="0.00"
            />
            <Field label="Rent period">
              <Choice
                options={RENT_PERIODS}
                value={room.rentPeriod}
                onChange={(v) => set("rentPeriod", v)}
              />
            </Field>
            <MoneyField
              label="Security deposit"
              value={room.securityDeposit}
              onChange={(e) => set("securityDeposit", e.target.value)}
              placeholder="0.00"
            />
            <MoneyField
              label="Holding deposit"
              value={room.holdingDeposit}
              onChange={(e) => set("holdingDeposit", e.target.value)}
              placeholder="0.00"
            />
          </div>

          <Field label="Room type">
            <Choice
              options={ROOM_TYPES}
              value={room.roomType}
              onChange={(v) => set("roomType", v)}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Size of room">
              <Choice
                options={OCCUPANCIES}
                value={room.occupancy}
                onChange={(v) => set("occupancy", v)}
              />
            </Field>
            <Field label="Bathroom">
              <Choice
                options={BATHROOM_TYPES}
                value={room.bathroomType}
                onChange={(v) => set("bathroomType", v)}
              />
            </Field>
            <Field label="Furnished">
              <Choice
                options={[
                  [true, "Furnished"],
                  [false, "Unfurnished"],
                ]}
                value={room.furnished}
                onChange={(v) => set("furnished", v)}
              />
            </Field>
            <TextField
              label="Floor"
              value={room.floor}
              onChange={(e) => set("floor", e.target.value)}
              placeholder="e.g., First"
            />
            <TextField
              label="Room size"
              value={room.roomSize}
              onChange={(e) => set("roomSize", e.target.value)}
              placeholder="e.g., 12 m²"
            />
            <TextField
              label="Wifi speed"
              value={room.wifiSpeed}
              onChange={(e) => set("wifiSpeed", e.target.value)}
              placeholder="e.g., 100 Mbps"
            />
          </div>

          <Field label="Bills included">
            <Choice
              options={BILLS_OPTIONS}
              value={room.billsOption}
              onChange={(v) => set("billsOption", v)}
            />
          </Field>

          {room.billsOption === "SOME" && (
            <Chips
              options={BILL_KEYS}
              values={BILL_KEYS.filter(([k]) => room.billsIncluded[k]).map(([k]) => k)}
              onToggle={(k) =>
                set("billsIncluded", {
                  ...room.billsIncluded,
                  [k]: !room.billsIncluded[k],
                })
              }
            />
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Availability">
              <Choice
                options={ROOM_STATUSES}
                value={room.status}
                onChange={(v) => set("status", v)}
              />
            </Field>
            <TextField
              label="Available from"
              type="date"
              value={room.availableFrom}
              onChange={(e) => set("availableFrom", e.target.value)}
            />
            <TextField
              label="Minimum stay (months)"
              type="number"
              min="1"
              value={room.minimumTenancy}
              onChange={(e) => set("minimumTenancy", e.target.value)}
            />
            <TextField
              label="Maximum stay (months)"
              type="number"
              min="0"
              value={room.maximumTenancy}
              onChange={(e) => set("maximumTenancy", e.target.value)}
              hint="Leave blank for no maximum."
            />
            <Field label="Viewings / move-in days">
              <Choice
                options={DAYS_AVAILABLE}
                value={room.daysAvailable}
                onChange={(v) => set("daysAvailable", v)}
              />
            </Field>
            <Field label="Short term lets considered">
              <Choice
                options={YES_NO}
                value={room.shortTermLets}
                onChange={(v) => set("shortTermLets", v)}
              />
            </Field>
          </div>

          <Field label="Room amenities">
            <Chips
              options={ROOM_AMENITIES}
              values={room.roomAmenities}
              onToggle={(v) => toggleIn("roomAmenities", v)}
            />
          </Field>

          <Field label="Shared / property amenities">
            <Chips
              options={SHARED_AMENITIES}
              values={room.propertyAmenities}
              onToggle={(v) => toggleIn("propertyAmenities", v)}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Smoking">
              <Choice
                options={SMOKING}
                value={room.prefSmoking}
                onChange={(v) => set("prefSmoking", v)}
              />
            </Field>
            <Field label="Pets">
              <Choice
                options={PETS}
                value={room.prefPets}
                onChange={(v) => set("prefPets", v)}
              />
            </Field>
            <Field label="Preferred tenant">
              <Choice
                options={OCCUPATIONS}
                value={room.prefOccupation}
                onChange={(v) => set("prefOccupation", v)}
              />
            </Field>
            <Field
              label="Gender"
              hint="Advertised preference only — it cannot lawfully be used to discriminate."
            >
              <Choice
                options={GENDERS}
                value={room.prefGender}
                onChange={(v) => set("prefGender", v)}
              />
            </Field>
          </div>

          <Field label="Couples welcome">
            <Choice
              options={YES_NO}
              value={room.prefCouplesWelcome}
              onChange={(v) => set("prefCouplesWelcome", v)}
            />
          </Field>

          <Field label="References required">
            <Choice
              options={YES_NO}
              value={room.referencesRequired}
              onChange={(v) => set("referencesRequired", v)}
            />
          </Field>

          <TextAreaField
            label="Room description"
            value={room.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What makes this room worth renting?"
          />

          {/* room photos */}
          <div>
            <label className={LABEL}>Room photos</label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50 rounded-xl p-5 text-center transition-all"
            >
              {uploading ? (
                <Loader2 size={20} className="mx-auto text-[#F47C3C] animate-spin" />
              ) : (
                <UploadCloud size={20} className="mx-auto text-gray-300" />
              )}
              <p className="text-xs font-bold text-[#0F253B] mt-1.5">
                {uploading ? "Uploading…" : "Add photos of this room"}
              </p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                handleImages(e.target.files);
                e.target.value = "";
              }}
            />

            {room.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {room.images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative group rounded-lg overflow-hidden border border-gray-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${room.roomName} ${i + 1}`}
                      className="w-full h-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "images",
                          room.images.filter((_, j) => j !== i)
                        )
                      }
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <TextAreaField
            label="Notes for the agency"
            value={room.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Internal notes about this room."
          />
        </div>
      )}
    </div>
  );
}
