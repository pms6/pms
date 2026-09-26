"use client";

// Room / property photos and videos on a check-in or check-out — the upload
// fields for the form, the thumbnails for the register table and the gallery
// for the detail view. Both registers use the same pieces so the two records
// of one tenancy (moving in, moving out) look the same side by side.

import { Camera, Video } from "lucide-react";
import { MediaUploader } from "../../Shared/MediaAttachments";
import { FileStrip, filesOf } from "../../Shared/registerParts";

const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

/**
 * The two uploaders for the form. `stage` is "check-in" or "check-out" and
 * only changes the wording. The parent tracks in-flight uploads through
 * `onUploadingChange(kind, count)` so it can hold the save until they finish.
 */
export function RegisterMediaFields({ stage, photos, onPhotosChange, videos, onVideosChange, onUploadingChange }) {
  const day = stage === "check-out" ? "at check-out" : "on the check-in day";
  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-4">
      <p className={LABEL}>Photos &amp; videos</p>
      <MediaUploader
        files={photos}
        onChange={onPhotosChange}
        onUploadingChange={(n) => onUploadingChange("photos", n)}
        accept="image/*"
        label="Room / property photos"
        hint={`Photos of the room and property taken ${day} — drop them here or click to choose`}
      />
      <MediaUploader
        files={videos}
        onChange={onVideosChange}
        onUploadingChange={(n) => onUploadingChange("videos", n)}
        accept="video/*"
        label={stage === "check-out" ? "Check-out videos" : "Check-in videos"}
        hint={`Walk-round videos taken ${day}`}
      />
    </div>
  );
}

// Counts for the register table, opening the viewer on click.
export function RegisterMediaCell({ row, onOpen }) {
  const photos = filesOf(row.photoFiles);
  const videos = filesOf(row.videoFiles);
  if (!photos.length && !videos.length) return <span className="text-gray-300">—</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-2.5 text-xs font-bold text-[#0F253B] hover:text-[#F47C3C]"
      title="View photos and videos"
    >
      {photos.length > 0 && (
        <span className="inline-flex items-center gap-1"><Camera size={13} /> {photos.length}</span>
      )}
      {videos.length > 0 && (
        <span className="inline-flex items-center gap-1"><Video size={13} /> {videos.length}</span>
      )}
    </button>
  );
}

// The gallery block in the detail view. `onOpen(files, label)` opens the
// viewer on one group.
export function RegisterMediaSection({ row, stage, onOpen }) {
  const photos = filesOf(row.photoFiles);
  const videos = filesOf(row.videoFiles);
  const videoLabel = stage === "check-out" ? "Check-out videos" : "Check-in videos";

  return (
    <div className="rounded-2xl border border-gray-100 p-4 mt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Photos &amp; videos</p>
      {!photos.length && !videos.length ? (
        <p className="text-sm text-gray-300 font-medium">No photos or videos uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {photos.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-400 font-medium w-36 shrink-0">Room photos ({photos.length})</span>
              <FileStrip files={photos} onOpen={() => onOpen(photos, "Room / property photos")} />
            </div>
          )}
          {videos.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-400 font-medium w-36 shrink-0">{videoLabel} ({videos.length})</span>
              <FileStrip files={videos} onOpen={() => onOpen(videos, videoLabel)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
