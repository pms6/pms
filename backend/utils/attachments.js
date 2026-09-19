import mongoose from "mongoose";

// One uploaded file on a record — a photo, a video, a PDF, anything.
//
// Any type is accepted: the proof is whatever the person on site captured, and
// a format whitelist would only keep it out of the record. `type` is
// Cloudinary's own classification, kept so the viewer knows to render a <video>
// rather than an <img> without re-deriving it from the URL every time.
//
// Mirrors the file shape used by the cleaning register and the compliance
// register, so the same uploader on the frontend feeds all of them.
export const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, required: true },
    // Kept so the file can be removed from Cloudinary later.
    publicId: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["image", "video", "pdf", "file"],
      default: "file",
    },
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FILE_TYPES = ["image", "video", "pdf", "file"];

// The attachments list straight from the frontend uploader. A URL is the only
// thing that makes an attachment worth keeping, so entries without one are
// dropped rather than stored as empty rows.
export const cleanAttachments = (files) => {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => f?.url)
    .map((f) => ({
      name: String(f.name ?? "").trim(),
      url: String(f.url).trim(),
      publicId: String(f.publicId ?? "").trim(),
      type: FILE_TYPES.includes(f.type) ? f.type : "file",
      format: String(f.format ?? "").trim(),
      bytes: Number(f.bytes) > 0 ? Number(f.bytes) : 0,
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : new Date(),
    }));
};
