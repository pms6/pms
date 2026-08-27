// utils/cloudinaryMirror.js
//
// Pull remote media into our own Cloudinary account.
//
// A CSV import arrives with links to wherever the agent happens to host their
// photos and paperwork. Those links rot, change, or disappear, and a tenant-
// facing listing pointing at someone else's server is not something we control.
// So every foreign URL is copied into Cloudinary on the way in and the
// Cloudinary URL is what gets stored.
//
// The copy is done by Cloudinary itself: its upload endpoint accepts a URL in
// the `file` field and fetches it server-side, so nothing is streamed through
// this process. Uploads are unsigned, using the same cloud + preset the browser
// uploader uses, which means no API secret is needed here.
//
// Mirroring is BEST EFFORT. If a link is dead, private, or too big, the
// original URL is kept rather than dropping the image — a listing pointing at a
// foreign host beats a listing with no photo.

import env from "../config/env.js";

// Defaults match src/app/utils/uploadToCloudinary.js on the frontend, so both
// uploaders land in the same account without extra configuration.
const CLOUD_NAME = env.cloudinary.cloudName || "et693ldf";
const UPLOAD_PRESET = env.cloudinary.uploadPreset || "pms123";

const UPLOAD_TIMEOUT_MS = 25000;
// How many files are fetched at once. Cloudinary does the downloading, so this
// is about not opening 40 sockets at once rather than local bandwidth.
const CONCURRENCY = 4;

const isHttpUrl = (url) => typeof url === "string" && /^https?:\/\//i.test(url);

/** Already in our own Cloudinary account — nothing to copy. */
export const isCloudinaryUrl = (url) =>
  typeof url === "string" &&
  new RegExp(`^https?://res\\.cloudinary\\.com/${CLOUD_NAME}/`, "i").test(url);

/**
 * Copy one remote file into Cloudinary.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {"image"|"auto"} [options.resourceType] "auto" accepts PDFs and Word
 *        documents as well as images.
 * @returns {Promise<{url: string, mirrored: boolean}>} the URL to store, and
 *          whether it is now ours. Never throws.
 */
export const mirrorToCloudinary = async (url, { resourceType = "image" } = {}) => {
  if (!isHttpUrl(url)) return { url: "", mirrored: false };
  if (isCloudinaryUrl(url)) return { url, mirrored: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const body = new FormData();
    // Cloudinary fetches this URL itself rather than us downloading it first.
    body.append("file", url);
    body.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: "POST", body, signal: controller.signal }
    );

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Cloudinary mirror: unreadable reply for ${url}: ${text.slice(0, 200)}`);
      return { url, mirrored: false };
    }

    if (!response.ok || !data.secure_url) {
      console.error(
        `Cloudinary mirror failed for ${url}: ${data?.error?.message || response.status}`
      );
      return { url, mirrored: false };
    }

    return { url: data.secure_url, mirrored: true };
  } catch (error) {
    const reason = error.name === "AbortError" ? "timed out" : error.message;
    console.error(`Cloudinary mirror failed for ${url}: ${reason}`);
    return { url, mirrored: false };
  } finally {
    clearTimeout(timer);
  }
};

/** Mirror a list of URLs, a few at a time. Order is preserved. */
export const mirrorMany = async (urls = [], options) => {
  const results = new Array(urls.length);
  let next = 0;

  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      results[index] = await mirrorToCloudinary(urls[index], options);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker)
  );

  return results;
};

/**
 * Copy every image and document on one property payload into Cloudinary,
 * rewriting the payload in place.
 *
 * @param {object} payload output of cleanPropertyInput
 * @returns {Promise<{mirrored: number, kept: number}>} how many files were
 *          copied, and how many kept their original URL because the copy failed
 *          (URLs already in our account count as neither).
 */
export const mirrorPropertyMedia = async (payload) => {
  let mirrored = 0;
  let kept = 0;

  const tally = (result, original) => {
    if (result.mirrored) mirrored += 1;
    else if (original && !isCloudinaryUrl(original)) kept += 1;
    return result.url;
  };

  const property = payload.property;

  // Cover + gallery in one pass so ordering stays stable.
  const propertyImages = [property.coverImage, ...property.gallery].filter(Boolean);
  if (propertyImages.length > 0) {
    const results = await mirrorMany(propertyImages);
    const urls = results.map((result, i) => tally(result, propertyImages[i]));
    property.coverImage = property.coverImage ? urls[0] : "";
    property.gallery = property.coverImage ? urls.slice(1) : urls;
  }

  // Documents may be PDFs or Word files, so they go through `auto`.
  if (property.documents.length > 0) {
    const results = await mirrorMany(
      property.documents.map((doc) => doc.url),
      { resourceType: "auto" }
    );
    property.documents = property.documents.map((doc, i) => ({
      ...doc,
      url: tally(results[i], doc.url),
    }));
  }

  for (const room of payload.rooms) {
    if (!room.images?.length) continue;
    const results = await mirrorMany(room.images.map((image) => image.url));
    room.images = room.images.map((image, i) => ({
      ...image,
      url: tally(results[i], image.url),
    }));
  }

  return { mirrored, kept };
};
