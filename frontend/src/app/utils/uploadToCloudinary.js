const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const uploadToCloudinary = async (file) => {

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary env variables missing");
  }

  if (!file) {
    throw new Error("No file selected");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds 10MB");
  }

  let folder = "files";

  if (file.type.startsWith("image/")) {
    folder = "images";
  } else if (
    file.type === "application/pdf" ||
    file.type.includes("word") ||
    file.type.includes("document")
  ) {
    folder = "documents";
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `RENTAROOMLONDON/${folder}`);

  // Cloudinary optimization
  formData.append("quality", "auto");
  formData.append("fetch_format", "auto");

  try {

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || "Upload failed");
    }

    return {
      url: data.secure_url,
      public_id: data.public_id,
      type: data.resource_type,
    };

  } catch (error) {
    throw new Error(error.message || "Upload request failed");
  }
};

export default uploadToCloudinary;