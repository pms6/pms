// utils/propertyCsv.js
//
// The CSV contract for bulk property imports, shared by the template download
// and the parser behind it (see Components/PropertyCsvImport.js).
//
// Shape: ONE ROW PER ROOM. A property's own columns repeat on each of its
// rooms, and the rows are grouped by `propertyRef`. A whole-property let that
// is not advertised room by room is a single row with every room column blank.
//
// Values follow the same conventions as the occupancy importer: flat camelCase
// headers, yyyy-mm-dd dates, model enum values verbatim (uppercase), and
// pipe-separated lists for anything multi-valued.

/** Canonical columns, in template order. */
export const CSV_COLUMNS = [
  "propertyRef",
  "propertyName", "rentalType", "tenantType", "status",
  "addressLine1", "addressLine2", "area", "city", "county", "postcode", "country",
  "latitude", "longitude",
  "ownerName", "ownerIsCompany", "ownerEmail", "ownerPhone", "ownerBankAccount", "ownerNotes",
  "description",
  "transportStation", "transportMinutes", "transportMode",
  "livingRoom", "amenities",
  "coverImage", "gallery", "documents",
  "contractAgreementType", "contractStartDate", "contractEndDate",
  "contractRentAmount", "contractRentPeriod", "contractNoticeMonths",
  "contractDepositScheme", "contractDepositAmount",
  "contractLandlordName", "contractTenantName", "contractRollsToPeriodic", "contractNotes",
  "roomName", "roomNumber", "roomType", "occupancy", "bathroomType", "furnished",
  "floor", "roomSize",
  "monthlyRent", "rentPeriod", "securityDeposit", "holdingDeposit",
  "billsOption", "billsIncluded",
  "roomStatus", "availableFrom", "minimumTenancy", "maximumTenancy",
  "shortTermLets", "daysAvailable", "referencesRequired",
  "roomAmenities", "sharedAmenities", "wifiSpeed",
  "prefSmoking", "prefGender", "prefOccupation", "prefPets", "prefCouplesWelcome",
  "roomImages", "roomDescription", "roomNotes",
];

/** Columns a row cannot be imported without. */
export const REQUIRED_COLUMNS = ["propertyName", "addressLine1"];

/** Documentation for the column reference shown in the import panel. */
export const COLUMN_HELP = [
  ["propertyRef", "Your own key. Rows sharing it become ONE property with several rooms — the first of them carries the property columns, the rest need only their room columns. Not stored."],
  ["propertyName", "Required. The property's name."],
  ["rentalType", "HMO · SINGLE_LET · SHORT_TERM · BLOCK. Defaults to HMO."],
  ["tenantType", "ANY · PROFESSIONAL · STUDENT · SOCIAL."],
  ["status", "ACTIVE · DRAFT · ARCHIVED — ignored on the public page: properties added there go live as ACTIVE."],
  ["addressLine1", "Required. Street address."],
  ["addressLine2 / area / city / county / postcode / country", "Rest of the address."],
  ["latitude / longitude", "Decimal degrees. Both or neither."],
  ["ownerName", "Owner or landlord. Rows with the same name are attached to a single Owner record."],
  ["ownerIsCompany", "true / false."],
  ["ownerEmail / ownerPhone / ownerBankAccount / ownerNotes", "Owner contact and payout details."],
  ["description", "Property description for the listing."],
  ["transportStation", "Nearest station or stop. Leave blank to omit transport entirely."],
  ["transportMinutes", "0-5 · 5-10 · 10-15 · 15-20 · 20-30 · 30+. Format the column as Text if you edit in Excel — it turns 5-10 into a date otherwise."],
  ["transportMode", "walk · bus · train · tube · tram."],
  ["livingRoom", "true / false / blank for not answered."],
  ["amenities", "Pipe-separated: parking | garden_patio | garage | balcony_terrace | disabled_access."],
  ["coverImage", "URL of the main photo."],
  ["gallery", "Pipe-separated photo URLs."],
  ["documents", "Pipe-separated items of name::url::type (CONTRACT, INSURANCE, INVENTORY, FLOOR_PLAN, LICENCE, OTHER)."],
  ["contract*", "Whole-property agreement: AST · COMPANY_LET · LICENCE · LODGER · OTHER, dates as yyyy-mm-dd, MONTHLY/WEEKLY, deposit scheme NONE · DPS · MYDEPOSITS · TDS."],
  ["roomName", "Leave every room column blank for a whole-property let. Otherwise required."],
  ["roomType", "STANDARD · ENSUITE · STUDIO · MASTER · DOUBLE · SINGLE."],
  ["occupancy", "SINGLE · DOUBLE · TWIN · FAMILY."],
  ["bathroomType", "private · shared (lowercase)."],
  ["furnished", "true / false."],
  ["monthlyRent", "Required when the row has a room. The figure for the rentPeriod given."],
  ["rentPeriod", "MONTHLY · WEEKLY."],
  ["billsOption", "YES · NO · SOME. YES and NO set every bill one way and ignore billsIncluded; only SOME reads it."],
  ["billsIncluded", "Pipe-separated: electricity | gas | water | wifi | internet | councilTax."],
  ["roomStatus", "AVAILABLE · AVAILABLE_SOON · RESERVED · OCCUPIED · MAINTENANCE."],
  ["availableFrom", "yyyy-mm-dd."],
  ["minimumTenancy / maximumTenancy", "Months. Blank maximum means no maximum."],
  ["shortTermLets", "true / false."],
  ["daysAvailable", "SEVEN_DAYS · WEEKDAYS · WEEKENDS."],
  ["referencesRequired", "true / false / blank."],
  ["roomAmenities", "Pipe-separated: single_bed | double_bed | desk | chair | wardrobe | tv | balcony | ensuite_bathroom | lockable_room | chest_of_drawers | mirror."],
  ["sharedAmenities", "Pipe-separated: wifi | washing_machine | dryer | dishwasher | shared_kitchen | parking | garden | lift | gym | security | cctv | cleaning_service | bike_storage."],
  ["pref*", "prefSmoking / prefPets: NO_PREFERENCE · YES · NO. prefGender: ANY · MALE · FEMALE. prefOccupation: ALL · STUDENTS_ONLY · NO_STUDENTS. prefCouplesWelcome: true/false."],
  ["roomImages", "Pipe-separated photo URLs for this room."],
];

// A spreadsheet header ("Property Name", "property_name") maps to the same
// canonical key, so imports are forgiving about spacing and case.
const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const CANON = Object.fromEntries(CSV_COLUMNS.map((c) => [norm(c), c]));

/** The only columns that hold a date. See DATE HANDLING below. */
export const DATE_COLUMNS = ["contractStartDate", "contractEndDate", "availableFrom"];

// ---------------------------------------------------------------------------
// DATE HANDLING
//
// Sheets must be read with { raw: true }. Left to guess, xlsx reads the text
// "5-10" (a perfectly good transportMinutes value) as the 10th of May and hands
// back a Date — so every non-date column that looks vaguely like one gets
// silently mangled. Reading raw keeps each cell as the literal text the file
// holds.
//
// The cost is that a real .xlsx date cell then arrives as an Excel serial
// number, so the serial is converted back here — but only for the three columns
// that are actually dates, where a bare number can't mean anything else.
// ---------------------------------------------------------------------------

// Excel's day 25569 is 1970-01-01. Done in UTC so a timezone can't roll the
// date back a day. The 1900 leap-year bug is below any date a letting uses.
const fromExcelSerial = (serial) => {
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const EXCEL_SERIAL_MIN = 20000; // 1954
const EXCEL_SERIAL_MAX = 80000; // 2119

/** Coerce one cell to the plain text the rest of this module expects. */
export const toYmd = (value, column) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = value == null ? "" : String(value).trim();

  if (DATE_COLUMNS.includes(column) && /^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= EXCEL_SERIAL_MIN && serial <= EXCEL_SERIAL_MAX) {
      return fromExcelSerial(serial);
    }
  }

  return raw;
};

/** Remap one raw sheet row's keys onto canonical column names. */
export const canonicalizeRow = (raw) => {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const canon = CANON[norm(key)];
    if (canon) out[canon] = toYmd(value, canon);
  }
  return out;
};

/** Headers in the file that we do not recognise — surfaced as a warning. */
export const unknownHeaders = (raw) =>
  Object.keys(raw || {}).filter((key) => key && !CANON[norm(key)]);

// --- cell coercion ----------------------------------------------------------

const text = (value) => (value == null ? "" : String(value).trim());

const list = (value) =>
  text(value)
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);

const TRUE = ["true", "yes", "y", "1"];
const FALSE = ["false", "no", "n", "0"];

// Blank means "not answered" for the tri-state fields, so this returns null
// rather than guessing false.
const bool = (value) => {
  const raw = text(value).toLowerCase();
  if (TRUE.includes(raw)) return true;
  if (FALSE.includes(raw)) return false;
  return null;
};

const boolOr = (value, fallback) => {
  const parsed = bool(value);
  return parsed === null ? fallback : parsed;
};

const number = (value) => {
  const raw = text(value).replace(/[£,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const upper = (value) => text(value).toUpperCase();

// Enum values are written in the model's own casing; anything unrecognised
// falls back rather than failing the row, matching the server's behaviour.
const enumOr = (value, allowed, fallback) => {
  const raw = upper(value);
  return allowed.includes(raw) ? raw : fallback;
};

const BILL_KEYS = ["electricity", "gas", "water", "wifi", "internet", "councilTax"];

const billsFrom = (option, included) => {
  if (option === "YES") return Object.fromEntries(BILL_KEYS.map((k) => [k, true]));
  if (option === "NO") return Object.fromEntries(BILL_KEYS.map((k) => [k, false]));

  const on = list(included).map((v) => v.toLowerCase().replace(/[^a-z]/g, ""));
  return Object.fromEntries(
    BILL_KEYS.map((k) => [k, on.includes(k.toLowerCase())])
  );
};

const documentsFrom = (value) =>
  list(value)
    .map((entry) => {
      // name::url::type — the URL is the only part that must be there.
      const [name, url, type] = entry.split("::").map((p) => (p || "").trim());
      return {
        name: name || url || "",
        url: url || name || "",
        type: enumOr(
          type,
          ["CONTRACT", "INSURANCE", "INVENTORY", "FLOOR_PLAN", "LICENCE", "OTHER"],
          "OTHER"
        ),
      };
    })
    .filter((doc) => /^https?:\/\//i.test(doc.url));

/** The key that decides which rows belong to the same property. */
export const groupKeyOf = (row) =>
  text(row.propertyRef) ||
  `${text(row.propertyName).toLowerCase()}|${text(row.postcode).toLowerCase()}`;

const roomFrom = (row) => ({
  roomName: text(row.roomName),
  title: text(row.roomName),
  roomNumber: text(row.roomNumber),
  description: text(row.roomDescription),
  roomType: enumOr(
    row.roomType,
    ["STANDARD", "ENSUITE", "STUDIO", "MASTER", "DOUBLE", "SINGLE"],
    "STANDARD"
  ),
  occupancy: enumOr(row.occupancy, ["SINGLE", "DOUBLE", "TWIN", "FAMILY"], "SINGLE"),
  furnished: boolOr(row.furnished, true),
  floor: text(row.floor),
  roomSize: text(row.roomSize),
  bathroomType: ["private", "shared"].includes(text(row.bathroomType).toLowerCase())
    ? text(row.bathroomType).toLowerCase()
    : "shared",
  monthlyRent: number(row.monthlyRent),
  rentPeriod: enumOr(row.rentPeriod, ["MONTHLY", "WEEKLY"], "MONTHLY"),
  securityDeposit: number(row.securityDeposit),
  holdingDeposit: number(row.holdingDeposit),
  billsOption: enumOr(row.billsOption, ["YES", "NO", "SOME"], "SOME"),
  billsIncluded: billsFrom(enumOr(row.billsOption, ["YES", "NO", "SOME"], "SOME"), row.billsIncluded),
  status: enumOr(
    row.roomStatus,
    ["AVAILABLE", "AVAILABLE_SOON", "RESERVED", "OCCUPIED", "MAINTENANCE"],
    "AVAILABLE"
  ),
  availableFrom: text(row.availableFrom) || null,
  minimumTenancy: number(row.minimumTenancy) ?? 6,
  maximumTenancy: number(row.maximumTenancy),
  shortTermLets: boolOr(row.shortTermLets, false),
  daysAvailable: enumOr(
    row.daysAvailable,
    ["SEVEN_DAYS", "WEEKDAYS", "WEEKENDS"],
    "SEVEN_DAYS"
  ),
  referencesRequired: bool(row.referencesRequired),
  roomAmenities: list(row.roomAmenities).map((v) => v.toLowerCase()),
  propertyAmenities: list(row.sharedAmenities).map((v) => v.toLowerCase()),
  wifiSpeed: text(row.wifiSpeed),
  images: list(row.roomImages)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({ url, alt: text(row.roomName) })),
  preferences: {
    smoking: enumOr(row.prefSmoking, ["NO_PREFERENCE", "YES", "NO"], "NO_PREFERENCE"),
    gender: enumOr(row.prefGender, ["ANY", "MALE", "FEMALE"], "ANY"),
    occupation: enumOr(
      row.prefOccupation,
      ["STUDENTS_ONLY", "NO_STUDENTS", "ALL"],
      "ALL"
    ),
    pets: enumOr(row.prefPets, ["NO_PREFERENCE", "YES", "NO"], "NO"),
    couplesWelcome: boolOr(row.prefCouplesWelcome, false),
  },
  notes: text(row.roomNotes),
});

const propertyFrom = (row) => {
  const lat = number(row.latitude);
  const lng = number(row.longitude);
  const gallery = list(row.gallery).filter((url) => /^https?:\/\//i.test(url));
  const cover = text(row.coverImage);

  return {
    name: text(row.propertyName),
    rentalType: enumOr(
      row.rentalType,
      ["HMO", "SINGLE_LET", "SHORT_TERM", "BLOCK"],
      "HMO"
    ),
    tenantType: enumOr(
      row.tenantType,
      ["ANY", "PROFESSIONAL", "STUDENT", "SOCIAL"],
      "ANY"
    ),
    ownerName: text(row.ownerName),
    address: {
      line1: text(row.addressLine1),
      line2: text(row.addressLine2),
      area: text(row.area),
      city: text(row.city),
      county: text(row.county),
      postcode: text(row.postcode),
      country: text(row.country) || "United Kingdom",
    },
    ...(lat !== null && lng !== null ? { location: { lat, lng } } : {}),
    description: text(row.description),
    ...(text(row.transportStation)
      ? {
          transport: {
            minutes: enumOr(
              row.transportMinutes,
              ["0-5", "5-10", "10-15", "15-20", "20-30", "30+"],
              "0-5"
            ),
            // These are the one enum group stored lowercase.
            mode: ["walk", "bus", "train", "tube", "tram"].includes(
              text(row.transportMode).toLowerCase()
            )
              ? text(row.transportMode).toLowerCase()
              : "walk",
            station: text(row.transportStation),
          },
        }
      : {}),
    livingRoom: bool(row.livingRoom),
    amenities: list(row.amenities).map((v) => v.toLowerCase()),
    contract: {
      agreementType: enumOr(
        row.contractAgreementType,
        ["AST", "COMPANY_LET", "LICENCE", "LODGER", "OTHER"],
        "AST"
      ),
      startDate: text(row.contractStartDate) || null,
      endDate: text(row.contractEndDate) || null,
      rentAmount: number(row.contractRentAmount),
      rentPeriod: enumOr(row.contractRentPeriod, ["MONTHLY", "WEEKLY"], "MONTHLY"),
      noticeMonths: number(row.contractNoticeMonths) ?? 1,
      depositScheme: enumOr(
        row.contractDepositScheme,
        ["NONE", "DPS", "MYDEPOSITS", "TDS"],
        "NONE"
      ),
      depositAmount: number(row.contractDepositAmount),
      landlordName: text(row.contractLandlordName) || text(row.ownerName),
      tenantName: text(row.contractTenantName),
      rollsToPeriodic: boolOr(row.contractRollsToPeriodic, true),
      notes: text(row.contractNotes),
    },
    documents: documentsFrom(row.documents),
    coverImage: cover || gallery[0] || "",
    gallery: cover ? gallery : gallery.slice(1),
  };
};

const ownerFrom = (row) => ({
  name: text(row.ownerName),
  company: boolOr(row.ownerIsCompany, false),
  email: text(row.ownerEmail),
  phone: text(row.ownerPhone),
  bank: { account: text(row.ownerBankAccount) },
  notes: text(row.ownerNotes),
});

/**
 * Turn canonical CSV rows into submission payloads — one per property, with
 * every row that carries a roomName folded in as a room.
 *
 * @param {object[]} rows canonical rows (see canonicalizeRow)
 * @returns {{ properties: object[], errors: string[] }} errors name the sheet
 *          row they came from, counting the header as row 1.
 */
export const rowsToProperties = (rows) => {
  const groups = new Map();
  const errors = [];

  rows.forEach((row, index) => {
    const sheetRow = index + 2; // +1 for zero-index, +1 for the header row

    const name = text(row.propertyName);
    const line1 = text(row.addressLine1);
    const ref = text(row.propertyRef);

    // A row with nothing in it is just spreadsheet padding, not an error.
    const empty = CSV_COLUMNS.every((c) => !text(row[c]));
    if (empty) return;

    const key = groupKeyOf(row);

    // A continuation row: another room for a property whose columns were given
    // further up under the same propertyRef. People fill sheets this way — the
    // property typed once, then a row per room — so only the FIRST row of a
    // propertyRef has to carry the property columns. Anything repeated on a
    // continuation row is ignored; the first row wins.
    const continuation = Boolean(ref) && groups.has(key);

    if (continuation) {
      groups.get(key).rowNumbers.push(sheetRow);
    } else {
      if (!name) {
        errors.push(
          ref
            ? `Row ${sheetRow}: propertyName is required — the first row of ${ref} must carry the property columns.`
            : `Row ${sheetRow}: propertyName is required.`
        );
        return;
      }
      if (!line1) {
        errors.push(
          ref
            ? `Row ${sheetRow}: addressLine1 is required — the first row of ${ref} must carry the property columns.`
            : `Row ${sheetRow}: addressLine1 is required.`
        );
        return;
      }

      groups.set(key, {
        owner: ownerFrom(row),
        property: propertyFrom(row),
        rooms: [],
        rowNumbers: [sheetRow],
      });
    }

    const roomName = text(row.roomName);
    if (!roomName) return; // whole-property row, no room to add

    const rent = number(row.monthlyRent);
    if (rent === null) {
      errors.push(
        `Row ${sheetRow}: "${roomName}" needs a monthlyRent — leave every room column blank if the property is let as a whole.`
      );
      return;
    }

    groups.get(key).rooms.push({ ...roomFrom(row), monthlyRent: rent });
  });

  return { properties: [...groups.values()], errors };
};

/** CSV text for the template, header plus whatever rows are passed in. */
export const toCsv = (rows = []) => {
  const cell = (value) => {
    const raw = value === undefined || value === null ? "" : String(value);
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };

  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((c) => cell(row[c])).join(",")),
  ].join("\r\n");
};
