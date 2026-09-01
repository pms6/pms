const cloudName = "et693ldf";
const uploadPreset = "pms123";

// ---------------------------------------------------------------------------
// Download URLs
// ---------------------------------------------------------------------------
// The HTML `download` attribute is ignored on cross-origin links, so pointing a
// download button at a Cloudinary URL just navigates to the file and lets the
// browser preview it instead. Cloudinary's `fl_attachment` flag is the fix: it
// serves the asset with Content-Disposition: attachment, so the browser saves
// it. The flag goes immediately after /upload/ in the delivery URL.
//
// `filename` (without extension) renames the saved file — worth setting, since
// the stored public_id is a random string rather than anything meaningful.
//
// Non-Cloudinary URLs are returned untouched; there is nothing useful to do
// with a host whose rules we don't know.
export const downloadUrlFor = (url, filename = "") => {
  if (!url || !/res\.cloudinary\.com\//i.test(url)) return url || "";
  if (/\/upload\/fl_attachment/i.test(url)) return url; // already one

  // Strip the extension and anything Cloudinary would choke on, so a name like
  // "Gas Safety 2025.pdf" becomes "Gas_Safety_2025".
  const safe = String(filename)
    .replace(/\.[^./]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  const flag = safe ? `fl_attachment:${safe}` : "fl_attachment";
  return url.replace(/\/upload\//, `/upload/${flag}/`);
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadToCloudinary = async (file) => {
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary environment variables missing");
  }

  if (!file) {
    throw new Error("No file selected");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are allowed");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image size must be less than 10MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  // Log the file details
  console.log("Uploading file:", {
    name: file.name,
    type: file.type,
    size: file.size,
    preset: uploadPreset,
    cloudName: cloudName
  });

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    // Get the response as text first
    const responseText = await response.text();
    console.log("Response status:", response.status);
    console.log("Response text:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", responseText);
      throw new Error(`Server returned: ${responseText}`);
    }

    if (!response.ok) {
      console.error("Cloudinary error details:", data);
      throw new Error(data?.error?.message || `Upload failed with status ${response.status}`);
    }

    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

export default uploadToCloudinary;

// ---------------------------------------------------------------------------
// Document upload (PDF + images) — used by tenant onboarding documents.
// Uses Cloudinary's `auto` resource type so non-image files (PDFs) are
// accepted. Returns { url, publicId, name, format, bytes }.
// NOTE: the unsigned upload preset ("pms123") must allow the `auto`/`raw`
// resource type for PDFs to succeed.
// ---------------------------------------------------------------------------
const DOC_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  // Word documents — contracts and tenancy agreements are usually .docx.
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export const uploadFileToCloudinary = async (file) => {
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary environment variables missing");
  }
  if (!file) {
    throw new Error("No file selected");
  }
  const isAllowed = ALLOWED_DOC_TYPES.includes(file.type) || file.type.startsWith("image/");
  if (!isAllowed) {
    throw new Error("Only PDF, Word (.doc/.docx) or image documents are allowed");
  }
  if (file.size > DOC_MAX_FILE_SIZE) {
    throw new Error("File size must be less than 15MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: formData }
  );

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Server returned: ${responseText}`);
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Upload failed with status ${response.status}`);
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    name: file.name,
    format: data.format || file.type,
    bytes: data.bytes || file.size,
  };
};