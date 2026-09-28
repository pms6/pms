"use client";

// The checkout inspection checklist — every item answered Yes / No with its
// own photos, videos and note, so the evidence for an item is filed under that
// item (a picture of the keys under "Keys Available") rather than in one
// general pile for the whole check-out.
//
// ChecklistFields is the editable list for the form; ChecklistSection is the
// read-only version for the detail view.

import { useEffect, useRef, useState } from "react";
import { Camera, Video, StickyNote, Loader2, X, Film } from "lucide-react";
import { uploadAttachment, previewKind } from "../../Shared/MediaAttachments";
import { FileStrip } from "../../Shared/registerParts";
import { Badge } from "../../Shared/ui";

const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const ANSWERS = [
  { v: "YES", text: "Yes" },
  { v: "NO", text: "No" },
  { v: "", text: "—" },
];

// One uploaded file with a remove button.
function Thumb({ file, onRemove }) {
  const kind = previewKind(file);
  return (
    <div className="relative">
      <a href={file.url} target="_blank" rel="noopener noreferrer" title={file.name || "Attachment"}>
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.name || "Photo"} className="h-14 w-14 rounded-lg border border-gray-100 bg-white object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-400">
            <Film size={18} />
          </span>
        )}
      </a>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="absolute -top-1.5 -right-1.5 rounded-full bg-white border border-gray-200 p-0.5 text-gray-400 hover:text-red-500"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// "Add Photo" / "Add Video" — a button that opens the picker for one kind.
function AddButton({ icon: Icon, text, accept, onPick }) {
  return (
    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-[#0F253B] hover:bg-gray-50 cursor-pointer">
      <Icon size={13} /> {text}
      <input
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          // Clear it so picking the same file again still fires a change.
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ChecklistItemRow({ item, onChange, onUploadingDelta }) {
  const [uploading, setUploading] = useState([]);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note));

  const upload = async (picked, field) => {
    const list = Array.from(picked || []);
    if (!list.length) return;
    setError("");
    setUploading((prev) => [...prev, ...list.map((f) => f.name)]);
    onUploadingDelta(list.length);

    const failures = [];
    await Promise.all(
      list.map(async (file) => {
        try {
          const attachment = await uploadAttachment(file);
          onChange((it) => ({ ...it, [field]: [...it[field], attachment] }));
        } catch (err) {
          failures.push(err.message || `${file.name} failed to upload`);
        } finally {
          setUploading((prev) => {
            const i = prev.indexOf(file.name);
            return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
          });
          onUploadingDelta(-1);
        }
      })
    );
    if (failures.length) setError(failures.join(" · "));
  };

  const removeAt = (field, i) => onChange((it) => ({ ...it, [field]: it[field].filter((_, idx) => idx !== i) }));

  const files = [
    ...item.photos.map((f, i) => ({ f, field: "photos", i })),
    ...item.videos.map((f, i) => ({ f, field: "videos", i })),
  ];

  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#0F253B]">{item.label}</span>
        <div className="flex gap-1">
          {ANSWERS.map((o) => (
            <button
              key={o.text}
              type="button"
              onClick={() => onChange((it) => ({ ...it, answer: o.v }))}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                item.answer === o.v
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white text-gray-400 border-gray-100 hover:bg-gray-100"
              }`}
            >
              {o.text}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <AddButton icon={Camera} text="Add Photo" accept="image/*" onPick={(fl) => upload(fl, "photos")} />
        <AddButton icon={Video} text="Add Video" accept="video/*" onPick={(fl) => upload(fl, "videos")} />
        {!noteOpen && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold text-[#0F253B] hover:bg-gray-50"
          >
            <StickyNote size={13} /> Notes
          </button>
        )}
      </div>

      {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

      {(files.length > 0 || uploading.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {files.map(({ f, field, i }) => (
            <Thumb key={field + (f.url || "") + i} file={f} onRemove={() => removeAt(field, i)} />
          ))}
          {uploading.map((name, i) => (
            <span
              key={name + i}
              title={`Uploading ${name}`}
              className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white"
            >
              <Loader2 size={16} className="text-[#F47C3C] animate-spin" />
            </span>
          ))}
        </div>
      )}

      {noteOpen && (
        <input
          className="w-full px-3 py-2 bg-white border border-gray-100 rounded-lg text-sm font-medium text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
          value={item.note}
          onChange={(e) => {
            const note = e.target.value;
            onChange((it) => ({ ...it, note }));
          }}
          placeholder={`Notes on ${item.label.toLowerCase()}`}
        />
      )}
    </div>
  );
}

/**
 * The editable checklist. `items` is the full list from checklistItemsOf and
 * `onChange` the form's setter. In-flight uploads are reported as a total
 * through `onUploadingChange(count)` so the form can hold the save.
 */
export function ChecklistFields({ items, onChange, onUploadingChange }) {
  const [inFlight, setInFlight] = useState(0);

  // Reported from an effect, not from inside a state updater, for the same
  // reason as MediaUploader: updaters run during render.
  const onUploadingChangeRef = useRef(onUploadingChange);
  useEffect(() => {
    onUploadingChangeRef.current = onUploadingChange;
  });
  useEffect(() => {
    onUploadingChangeRef.current?.(inFlight);
  }, [inFlight]);

  const updateItem = (key) => (updater) =>
    onChange((prev) => prev.map((it) => (it.key === key ? updater(it) : it)));

  const answered = items.filter((it) => it.answer).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={LABEL + " mb-0"}>Checkout inspection checklist</label>
        <span className="text-[11px] font-bold text-gray-400">
          {answered}/{items.length} answered
        </span>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <ChecklistItemRow
            key={it.key}
            item={it}
            onChange={updateItem(it.key)}
            onUploadingDelta={(d) => setInFlight((n) => n + d)}
          />
        ))}
      </div>
    </div>
  );
}

const ANSWER_TONE = { YES: "green", NO: "red" };
const ANSWER_TEXT = { YES: "Yes", NO: "No" };

/**
 * Read-only checklist for the detail view. `onOpen(files, label)` opens the
 * viewer on one item's photos and videos.
 */
export function ChecklistSection({ items, onOpen }) {
  const recorded = items.filter((it) => it.answer || it.note || it.photos.length || it.videos.length);

  return (
    <div className="rounded-2xl border border-gray-100 p-4 mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
        Checkout inspection checklist
      </p>
      {recorded.length === 0 ? (
        <p className="text-sm text-gray-300 font-medium">Nothing recorded on the checklist yet.</p>
      ) : (
        <div className="space-y-2.5">
          {recorded.map((it) => {
            const files = [...it.photos, ...it.videos];
            return (
              <div key={it.key} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-medium w-44 shrink-0">{it.label}</span>
                  {it.answer ? (
                    <Badge tone={ANSWER_TONE[it.answer]}>{ANSWER_TEXT[it.answer]}</Badge>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                  {files.length > 0 && (
                    <div className="ml-auto">
                      <FileStrip files={files} onOpen={() => onOpen(files, it.label)} />
                    </div>
                  )}
                </div>
                {it.note && <p className="mt-0.5 text-[12px] text-[#0F253B] font-medium sm:ml-[11.75rem]">{it.note}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every photo and video attached to any checklist item, flattened. */
export const checklistFiles = (items) => ({
  photos: items.flatMap((it) => it.photos),
  videos: items.flatMap((it) => it.videos),
});
