"use client";

// What kind of file is behind a stored URL?
//
// The subtlety this exists to handle: Cloudinary's `auto` upload classifies a
// PDF as an IMAGE resource, so a PDF comes back as
//
//   https://res.cloudinary.com/<cloud>/image/upload/v123/Invoice-0045.pdf
//
// Anything that decides "is this an image?" by looking for /image/upload/ will
// therefore say yes to every PDF and try to render it in an <img>, which can
// never work. The extension is the reliable signal and must be checked FIRST;
// the /image/upload/ heuristic is only a fallback for Cloudinary URLs that
// carry no extension at all.

const IMAGE_EXT = /^(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif)$/i;
const DOC_EXT = /^(docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|zip)$/i;

/** Lowercased extension of a URL or filename, or "" when there isn't one. */
export const extensionOf = (value) => {
  if (!value) return "";
  const clean = String(value).split(/[?#]/)[0];
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
};

/**
 * "image" | "pdf" | "doc" | "other"
 *
 * `name` is consulted when the URL itself carries no extension, which is common
 * for Cloudinary image URLs.
 */
export function fileKind(url, name = "") {
  const ext = extensionOf(url) || extensionOf(name);

  if (ext) {
    if (IMAGE_EXT.test(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (DOC_EXT.test(ext)) return "doc";
    return "other";
  }

  // No extension anywhere. A Cloudinary image URL is the only thing that
  // reliably looks like this, so the old heuristic is safe as a last resort.
  if (/\/image\/upload\//.test(String(url || ""))) return "image";
  return "other";
}

export const isImageFile = (url, name) => fileKind(url, name) === "image";
export const isPdfFile = (url, name) => fileKind(url, name) === "pdf";

/** Short human label for a file badge, e.g. "PDF", "JPG", "FILE". */
export const kindLabel = (url, name) => {
  const ext = extensionOf(url) || extensionOf(name);
  return ext ? ext.toUpperCase() : "FILE";
};
