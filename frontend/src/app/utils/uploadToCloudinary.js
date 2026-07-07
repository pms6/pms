const cloudName = "et693ldf";
const uploadPreset = "pms123";

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