/**
 * Can this server actually delete a file from Cloudinary?
 *
 * Screenshot retention depends on a SIGNED delete, which needs
 * CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. Uploads
 * do not — they go up unsigned from the browser with an upload preset — so the
 * app can look perfectly healthy while every purge silently fails.
 *
 * This answers the question in one command instead of waiting for the nightly
 * job to log a warning.
 *
 *   node scripts/checkCloudinaryDelete.js
 *
 * It deletes a public_id that cannot exist, so it can never remove real data.
 * Cloudinary answers "not found" for a valid signature and an error for a bad
 * one, which is exactly the difference worth knowing.
 */
import env from "../config/env.js";
import { destroyAsset, canDeleteFromCloudinary } from "../utils/cloudinaryDelete.js";

const shown = (value) => (value ? "set" : "MISSING");

const run = async () => {
  console.log("Cloudinary delete credentials:");
  console.log(`  CLOUDINARY_CLOUD_NAME   ${shown(env.cloudinary.cloudName)}`);
  console.log(`  CLOUDINARY_API_KEY      ${shown(env.cloudinary.apiKey)}`);
  console.log(`  CLOUDINARY_API_SECRET   ${shown(env.cloudinary.apiSecret)}`);
  console.log("");

  if (!canDeleteFromCloudinary()) {
    console.log("✖ Screenshots CANNOT be deleted. Fill in the missing value(s) in backend/.env,");
    console.log("  then restart the API. Find the key and secret in the Cloudinary console");
    console.log("  under Settings → API Keys, for the account that owns the cloud name above.");
    process.exit(1);
  }

  // A public_id nothing could ever have been uploaded under.
  const probe = `pms-delete-check/${Date.now()}-does-not-exist`;
  const result = await destroyAsset(probe);

  if (result.ok) {
    console.log("✔ Signed delete works — expired screenshots will be removed from storage.");
    process.exit(0);
  }

  console.log(`✖ Cloudinary refused the signed delete: ${result.reason}`);
  console.log("  The usual cause is a key/secret that belongs to a different cloud name.");
  process.exit(1);
};

run().catch((err) => {
  console.error("Check failed:", err.message);
  process.exit(1);
});
