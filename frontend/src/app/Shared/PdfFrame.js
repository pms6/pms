"use client";

import { useEffect, useState } from "react";

// Embedded PDF viewer that checks the file is actually being served before it
// tries to show it.
//
// Why the check exists: left to itself, an <object> handed a URL the host
// refuses renders the HOST'S error inside the frame — which is where messages
// like "doesn't support PDF format" come from. They read as a browser
// limitation when the real cause is the file host saying no, so the file is
// requested first and a refusal is explained in our own words.
//
// The usual refusal: Cloudinary's `auto` upload files a PDF as an "image"
// resource, so it is delivered from /image/upload/<...>.pdf. PDF delivery from
// that path is switched OFF by default on every Cloudinary account ("PDF and
// ZIP files delivery", Settings → Security) and a blocked file answers 401.
const isCloudinaryImagePdf = (url) =>
  /res\.cloudinary\.com\/.+\/image\/upload\//i.test(String(url || ""));

/**
 * @param {string}  url       the PDF to show
 * @param {string}  title     accessible title for the frame
 * @param {string}  className sizing/box styles for the frame and the panel that
 *                            replaces it
 * @param {boolean} compact   smaller type, for a PDF sitting inside a card
 * @param {"staff"|"tenant"} audience who is reading the failure message. Staff
 *                            get the setting to change; a tenant cannot touch
 *                            the file host, so they are told who to ask.
 */
export default function PdfFrame({
  url,
  title = "PDF",
  className = "",
  compact = false,
  audience = "staff",
}) {
  // null = not checked yet or inconclusive, 0 = reachable, >0 = refused with
  // that HTTP status.
  const [refusedStatus, setRefusedStatus] = useState(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    (async () => {
      try {
        // First kilobyte only — enough to learn whether the host will serve it
        // without pulling the whole document down twice.
        const res = await fetch(url, { headers: { Range: "bytes=0-1023" } });
        if (!cancelled) setRefusedStatus(res.ok ? 0 : res.status);
      } catch {
        // Offline, CORS, or a refusal at a level fetch cannot read. Nothing
        // reliable to report, so leave it null and let the embed try — this
        // check can only add information, never remove any.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (refusedStatus > 0) {
    const blockedByCloudinary = refusedStatus === 401 && isCloudinaryImagePdf(url);

    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 px-6 py-4 text-center bg-amber-50 border border-amber-200 ${className}`}
      >
        <p className={`font-bold text-amber-800 ${compact ? "text-xs" : "text-sm"}`}>
          The file host refused this PDF ({refusedStatus}).
        </p>
        <p
          className={`font-medium text-amber-700 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {blockedByCloudinary && audience === "staff" ? (
            <>
              The file uploaded fine and the record is intact — Cloudinary is
              declining to deliver it. PDF delivery is switched off by default:
              turn on <span className="font-bold">PDF and ZIP files delivery</span> in
              the Cloudinary console under Settings → Security, and every stored PDF
              starts opening again.
            </>
          ) : audience === "tenant" ? (
            <>
              The document is on file — the system it is stored in is refusing to
              hand it over. Please ask your property manager to look into it.
            </>
          ) : (
            <>
              The record is fine — the file could not be fetched from where it is
              stored. Try the link below; if that fails too, re-upload it.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <object data={url} type="application/pdf" title={title} className={className}>
      {/* Shown when the browser cannot embed it — a missing file lands here
          rather than on a blank frame. */}
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className={`font-bold text-[#0F253B] ${compact ? "text-xs" : "text-sm"}`}>
          This document could not be displayed.
        </p>
        <p className={`font-medium text-gray-500 ${compact ? "text-[11px]" : "text-xs"}`}>
          Use the download or open link to view it instead.
        </p>
      </div>
    </object>
  );
}
