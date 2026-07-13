// Shared helpers for the public property/room listings (home page + detail).

export const RENTAL_TYPE_LABEL = {
  HMO: "HMO",
  SINGLE_LET: "Single Let",
  SHORT_TERM: "Short Let",
  BLOCK: "Block",
};

export const RENTAL_TYPE_TONE = {
  HMO: "orange",
  SINGLE_LET: "navy",
  SHORT_TERM: "navy",
  BLOCK: "navy",
};

// HMO = room-by-room house share. Everything else is let as a whole unit.
export const isHmo = (property) => property?.rentalType === "HMO";

const FALLBACK = (seed) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed || "pms")}/800/600`;

// Best available image for a property.
export const propertyImage = (property) =>
  property?.coverImage ||
  (Array.isArray(property?.gallery) && property.gallery[0]) ||
  FALLBACK(property?.propertyCode || property?._id || property?.name);

// Best available image for a room; falls back to its property's cover.
export const roomImage = (room) =>
  room?.images?.[0]?.url ||
  room?.propertyId?.coverImage ||
  FALLBACK(room?.listingCode || room?._id || room?.roomName);

// "£750" — whole pounds, thousands separated. Returns "" for null/undefined.
export const formatMoney = (n) =>
  n == null || n === "" ? "" : `£${Number(n).toLocaleString("en-GB")}`;

// "Shoreditch, London" from a property address object.
export const propertyLocation = (property) => {
  const a = property?.address || {};
  return [a.line1, a.city, a.postcode].filter(Boolean).join(", ") || "United Kingdom";
};

// Short availability label for a card badge.
export const availabilityLabel = (property) => {
  const s = property?.roomStats;
  if (!s) return "";
  if (s.available > 0) return `${s.available} room${s.available > 1 ? "s" : ""} available`;
  if (s.availableSoon > 0) return "Available soon";
  return "Fully occupied";
};
