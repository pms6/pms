"use client";

import { useState } from "react";
import { FileText, Download, X, UploadCloud, Loader2, Paperclip, Film } from "lucide-react";
import { Badge } from "./ui";
import PdfFrame from "./PdfFrame";
import { fileKind, kindLabel } from "./fileType";
import {
  uploadAnyFileToCloudinary,
  uploadMediaToCloudinary,
  downloadUrlFor,
  formatBytes,
} from "@/app/utils/uploadToCloudinary";
/* ------------------------------------------------------------------ *
 * Attachments of any type — the picker, the list and the viewer.
 *
 * Written against the compliance register's evidence section, which is the
 * pattern this app already uses for "here is the paperwork behind a record",
 * and pulled out here so a second register does not need a second copy of it.
 * ------------------------------------------------------------------ */

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|3gp|ogv)(\?|#|$)/i;

const fallbackKind = (file) => {
  const url = file?.url || "";
  const name = file?.name || "";
  if (VIDEO_EXT.test(url) || VIDEO_EXT.test(name)) return "video";
  const kind = fileKind(url, name);
  return kind === "image" || kind === "pdf" ? kind : "file";
};

/**
 * How to render this attachment: "image" | "video" | "pdf" | "file".
 *
 * The stored `type` wins, because Cloudinary classified the upload itself. It
 * is only absent on records written before attachments carried one, so the
 * extension is the fallback — and it is the extension, not the URL, because
 * Cloudinary serves a PDF from an /image/upload/ path and anything reading the
 * path would try to render a PDF in an <img>.
 */
export const previewKind = (file) => {
  const stored = file?.type;
  if (stored === "image" || stored === "video" || stored === "pdf") return stored;
  return fallbackKind(file);
};

/**
 * Upload one file of ANY type, routed to the endpoint that can actually take it.
 *
 * Video goes through the media path and everything else through the any-file
 * path, for one reason: the any-file path caps at 10MB, which is Cloudinary's
 * ceiling for RAW uploads and is the right guard for an arbitrary attachment —
 * but a phone clip of a machine running its cycle is routinely bigger than
 * that, and Cloudinary's video pipeline allows far more. Sending video down the
 * raw path would reject exactly the evidence this exists to collect.
 *
 * Returns the shape the schema stores, so callers hand the list straight to the
 * API without reshaping it.
 */
export const uploadAttachment = async (file) => {
  const isVideo = (file.type || "").startsWith("video/");

  const up = isVideo
    ? await uploadMediaToCloudinary(file)
    : await uploadAnyFileToCloudinary(file);

  return {
    name: up.name,
    url: up.url,
    publicId: up.publicId,
    // uploadMediaToCloudinary classifies the upload itself; the any-file path
    // does not, so read it back off the extension.
    type: up.type || fallbackKind({ url: up.url, name: up.name }),
    format: up.format || "",
    bytes: up.bytes || 0,
    uploadedAt: new Date(),
  };
};

const KIND_TONE = { image: "blue", video: "orange", pdf: "red", file: "gray" };

/**
 * One attachment. `onRemove` makes it an editable row in a form; without it the
 * row is read-only, as it is in the viewer.
 *
 * Downloads go through downloadUrlFor so the file saves under its original name
 * rather than Cloudinary's random public_id.
 */
export function AttachmentRow({ file, onRemove }) {
  const kind = previewKind(file);
  const label = file.name || file.url;
  const size = formatBytes(file.bytes);
  const Icon = kind === "video" ? Film : FileText;

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
      <Icon size={14} className="text-gray-400 shrink-0" />

      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-[#0F253B] hover:text-[#F47C3C] truncate"
        title={label}
      >
        {label}
      </a>

      <Badge tone={KIND_TONE[kind] || "gray"}>{kindLabel(file.url, file.name)}</Badge>
      {size && <span className="text-[11px] text-gray-300 font-medium shrink-0">{size}</span>}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        <a
          href={downloadUrlFor(file.url, file.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"
          title="Download"
        >
          <Download size={14} />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Pick, drop and list attachments.
 *
 * `files` and `onChange` are the form's own state — the uploader does not own
 * the list, so a parent can seed it from a record being edited. What it does
 * own is the in-flight set, reported through `onUploadingChange` so the form
 * can refuse to submit mid-upload and lose whatever has not landed yet.
 */
export function MediaUploader({
  files = [],
  onChange,
  onUploadingChange,
  label = "Attachments",
  hint = "Drop files here, or click to choose — photos, video, PDFs, any file type",
}) {
  const [uploading, setUploading] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const trackUploading = (updater) =>
    setUploading((prev) => {
      const next = updater(prev);
      onUploadingChange?.(next.length);
      return next;
    });

  /**
   * Upload a batch. Each file goes up independently and is appended as it
   * lands, so one rejected file does not lose the others — failures are
   * collected and reported together.
   */
  const uploadFiles = async (picked) => {
    const list = Array.from(picked || []);
    if (!list.length) return;

    setError("");
    trackUploading((prev) => [...prev, ...list.map((f) => f.name)]);

    const failures = [];

    await Promise.all(
      list.map(async (file) => {
        try {
          const attachment = await uploadAttachment(file);
          onChange?.((prev) => [...prev, attachment]);
        } catch (err) {
          failures.push(err.message || `${file.name} failed to upload`);
        } finally {
          // Remove one occurrence, not every match — two files picked from
          // different folders can share a name.
          trackUploading((prev) => {
            const i = prev.indexOf(file.name);
            return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
          });
        }
      })
    );

    if (failures.length) setError(failures.join(" · "));
  };

  const onPick = (e) => {
    uploadFiles(e.target.files);
    // Clear the input so picking the same file again still fires a change.
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer?.files);
  };

  const removeAt = (i) => onChange?.((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}
      </label>

      {error && (
        <div className="mb-2 p-2.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
          {error}
        </div>
      )}

      <div className="space-y-2 mb-2">
        {files.map((f, i) => (
          <AttachmentRow key={(f.url || "") + i} file={f} onRemove={() => removeAt(i)} />
        ))}

        {uploading.map((name, i) => (
          <div key={name + i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Loader2 size={14} className="text-[#F47C3C] shrink-0 animate-spin" />
            <span className="text-sm font-medium text-gray-400 truncate">{name}</span>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-gray-300">
              Uploading
            </span>
          </div>
        ))}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragging
            ? "border-[#F47C3C] bg-orange-50 text-[#F47C3C]"
            : "border-gray-200 bg-gray-50/50 text-gray-400 hover:bg-gray-50"
        }`}
      >
        <UploadCloud size={18} />
        <span className="text-xs font-bold text-center">{hint}</span>
        <input type="file" multiple className="hidden" onChange={onPick} />
      </label>
    </div>
  );
}

/**
 * Look at what is attached to a record.
 *
 * Images and video play inline, PDFs go through PdfFrame (which checks the host
 * will actually serve the file before embedding it), and anything else falls
 * back to the download button — which is always there, whatever the type.
 */
export function MediaViewerModal({ title, subtitle, files = [], onClose }) {
  // Which attachment is showing. Key this component on the record id so opening
  // a different record mounts a fresh one starting at 0 — then file 3 of the
  // last record cannot carry over to one that has only a single file.
  const [active, setActive] = useState(0);

  const current = files[Math.min(active, files.length - 1)];
  const url = current?.url;
  const name = current?.name || "Attachment";
  const kind = current ? previewKind(current) : "file";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#0F253B] truncate">{title || "Attachments"}</h3>
            {subtitle && <p className="text-xs font-medium text-gray-400 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* File switcher — only worth showing when there is more than one. */}
        {files.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-6 py-3 border-b border-gray-100">
            {files.map((f, i) => (
              <button
                key={(f.url || "") + i}
                onClick={() => setActive(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${
                  i === active
                    ? "bg-[#0F253B] text-white border-[#0F253B]"
                    : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                }`}
              >
                <Paperclip size={12} />
                <span className="max-w-[160px] truncate">{f.name || `File ${i + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-gray-100 min-h-[18rem]">
          {!url ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center px-6 text-center">
              <p className="text-sm font-bold text-gray-400">Nothing is attached to this entry.</p>
            </div>
          ) : kind === "video" ? (
            <div className="flex items-center justify-center p-4">
              <video src={url} controls className="max-h-[65vh] w-auto rounded-xl bg-black" />
            </div>
          ) : kind === "pdf" ? (
            <PdfFrame url={url} title={name} className="w-full h-[65vh]" />
          ) : kind === "image" ? (
            <div className="flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={name}
                className="max-h-[65vh] w-auto rounded-xl bg-white object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 px-6 text-center">
              <FileText size={28} className="text-gray-300" />
              <p className="text-sm font-bold text-[#0F253B]">
                {kindLabel(url, current?.name)} files can&apos;t be previewed here.
              </p>
              <p className="text-xs font-medium text-gray-500">
                Download it to open in its own app.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 truncate min-w-0">{url ? name : ""}</p>
          <div className="flex gap-2 shrink-0">
            {url && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-[#0F253B] hover:bg-gray-50"
                >
                  Open in new tab
                </a>
                <a
                  href={downloadUrlFor(url, current?.name)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm"
                >
                  <Download size={16} /> Download
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
