// utils/cloudinaryDelete.js
//
// Delete an asset from Cloudinary for real.
//
// This exists because "we deleted it" has to mean the image is gone. Removing
// the row that points at a screenshot leaves the screenshot itself sitting on a
// public, unauthenticated Cloudinary URL forever — so anybody who kept the link
// still has the picture after the retention period expired. Dropping the record
// and keeping the file is the worst of both worlds: the organisation can no
// longer see what it is still storing.
//
// Uploads are UNSIGNED (an upload preset, from the browser). Deletes cannot be:
// Cloudinary requires an authenticated, signed call, which is why this lives on
// the server and needs CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET set. Without
// them nothing here can work, and the caller is told so rather than being left
// believing a purge removed the files.

import crypto from "crypto";
import env from "../config/env.js";

const DESTROY_TIMEOUT_MS = 15000;

/** Are the signed-API credentials configured? Deletes are impossible without. */
export const canDeleteFromCloudinary = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

/**
 * Cloudinary's signature: the signed parameters sorted by name, joined as a
 * query string, with the API secret appended, hashed with SHA-1.
 */
const sign = (params) => {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(canonical + env.cloudinary.apiSecret)
    .digest("hex");
};

/**
 * Delete one asset.
 *
 * @param {string} publicId Cloudinary's own id for the asset, stored when it
 *        was uploaded. Without it there is nothing to address the file by.
 * @param {object} [options]
 * @param {"image"|"video"|"raw"} [options.resourceType]
 * @returns {Promise<{ok: boolean, reason?: string}>} Never throws — a purge
 *          sweeping hundreds of files must not stop at the first failure.
 */
export const destroyAsset = async (publicId, { resourceType = "image" } = {}) => {
  if (!publicId) return { ok: false, reason: "no publicId stored" };
  if (!canDeleteFromCloudinary()) return { ok: false, reason: "Cloudinary API credentials not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DESTROY_TIMEOUT_MS);

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = { public_id: publicId, timestamp };

    const body = new URLSearchParams({
      ...signedParams,
      api_key: env.cloudinary.apiKey,
      signature: sign(signedParams),
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/${resourceType}/destroy`,
      { method: "POST", body, signal: controller.signal }
    );

    const data = await response.json().catch(() => ({}));

    // Cloudinary answers 200 with { result: "ok" | "not found" }. "not found"
    // counts as done: the file is not there, which is the outcome we wanted.
    if (data?.result === "ok" || data?.result === "not found") return { ok: true };

    return { ok: false, reason: data?.error?.message || data?.result || `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, reason: error.name === "AbortError" ? "timed out" : error.message };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Delete many assets, a few at a time so a large purge does not open hundreds
 * of sockets at once.
 *
 * @returns {Promise<{deleted: number, failed: number, reasons: string[]}>}
 */
export const destroyMany = async (publicIds = [], options) => {
  const ids = publicIds.filter(Boolean);
  const result = { deleted: 0, failed: 0, reasons: [] };
  if (!ids.length) return result;

  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const outcomes = await Promise.all(
      ids.slice(i, i + BATCH).map((id) => destroyAsset(id, options))
    );
    for (const outcome of outcomes) {
      if (outcome.ok) result.deleted++;
      else {
        result.failed++;
        if (outcome.reason && !result.reasons.includes(outcome.reason)) {
          result.reasons.push(outcome.reason);
        }
      }
    }
  }

  return result;
};
