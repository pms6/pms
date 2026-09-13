"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Paperclip, Download } from "lucide-react";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?.*)?$/i;

const isImage = (a) => IMAGE_EXT.test(a?.url || a?.name || "");

/**
 * A full-screen viewer over one list of attachments, with left/right
 * navigation — so opening a report's five photos means one click and the
 * arrow keys, not five new browser tabs.
 */
export default function AttachmentLightbox({ items, index, onClose, onNavigate }) {
  const count = items.length;
  const item = items[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onNavigate((index - 1 + count) % count);
      else if (e.key === "ArrowRight") onNavigate((index + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onClose, onNavigate]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
        title="Close"
      >
        <X size={24} />
      </button>

      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index - 1 + count) % count); }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 sm:p-3 transition-all"
          title="Previous"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <div
        className="max-w-4xl max-h-[85vh] w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage(item) ? (
          <img
            src={item.url}
            alt={item.name || "Attachment"}
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-3 max-w-sm text-center">
            <Paperclip size={32} className="text-[#F47C3C]" />
            <p className="font-bold text-[#0F253B] break-all">{item.name || "Attachment"}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl text-sm transition-all"
            >
              <Download size={16} /> Open file
            </a>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-white/80 text-sm font-medium">
          <span className="truncate max-w-[60vw]">{item.name || "Attachment"}</span>
          {count > 1 && <span className="text-white/50">· {index + 1} / {count}</span>}
        </div>
      </div>

      {count > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index + 1) % count); }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2 sm:p-3 transition-all"
          title="Next"
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  );
}
