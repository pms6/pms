// utils/pdf/common.js
//
// Shared plumbing for the PDFs the API generates (inventory reports, invoices):
// the pdfmake printer, image loading, and a couple of formatting helpers.
//
// pdfmake runs on pdfkit's built-in Helvetica, so there are no font files to
// ship or keep in step with the package.

import PdfPrinter from "pdfmake/src/printer.js";

const printer = new PdfPrinter({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});

export const NAVY = "#0F253B";
export const ORANGE = "#F47C3C";
export const GREY = "#6B7280";
export const RULE = "#D1D5DB";
export const SHADE = "#F3F4F6";

/** Render a pdfmake document definition to a Buffer. */
export const renderPdf = (docDefinition) =>
  new Promise((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument({
        ...docDefinition,
        defaultStyle: { font: "Helvetica", fontSize: 9, color: "#111827", ...(docDefinition.defaultStyle || {}) },
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });

const IMAGE_TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

/**
 * A Cloudinary delivery URL rewritten to a PDF-friendly rendition: bounded in
 * size (a phone photo is 4000px and several MB; a third of an A4 page needs a
 * fraction of that) and converted to JPEG, which pdfmake can embed whatever the
 * original was (HEIC, WebP). A video becomes its first-second frame. Anything
 * not on Cloudinary is fetched as-is.
 */
export const pdfImageUrl = (url, { kind = "image", size = 900, png = false } = {}) => {
  const u = String(url || "");
  if (!/res\.cloudinary\.com\/.+\/(image|video)\/upload\//i.test(u)) return u;
  const fmt = png ? "f_png" : "f_jpg,q_70";
  const t = `w_${size},h_${size},c_limit,${fmt}`;
  if (kind === "video") {
    return u.replace(/\/video\/upload\//i, `/video/upload/so_1,${t}/`).replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1");
  }
  return u.replace(/\/image\/upload\//i, `/image/upload/${t}/`);
};

/** Fetch one image as a data URL pdfmake accepts, or null if it cannot be had. */
export const fetchImage = async (url, opts) => {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(pdfImageUrl(url, opts), { signal: controller.signal });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    // pdfmake embeds JPEG and PNG only.
    const mime = type.includes("png") ? "image/png" : type.includes("jpeg") || type.includes("jpg") ? "image/jpeg" : null;
    if (!mime) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Fetch many images at once, a few at a time. `jobs` is [{ key, url, opts }];
 * returns a Map of key → data URL for the ones that loaded. A photo that fails
 * is left out of the PDF rather than failing the whole document.
 */
export const fetchImages = async (jobs) => {
  const out = new Map();
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      const data = await fetchImage(job.url, job.opts);
      if (data) out.set(job.key, data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return out;
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export const fmtShortDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "");

export const fmtMoney = (n) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n) || 0);

/** Safe filename part: "53 Rowsley Ave" → "53-Rowsley-Ave". */
export const fileSlug = (s) =>
  String(s || "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
