// utils/orgSlug.js
//
// The public property submission form lives at a URL built from the
// organization's NAME (e.g. /list-property/melrose-lettings). Organization has
// no stored slug field, so the name is slugified on the way out and matched
// back with a regex on the way in — "Melrose Lettings", "melrose  lettings" and
// "Melrose-Lettings" all resolve to the same record.

import Organization from "../models/Organization.js";

/** "Melrose Lettings Ltd." -> "melrose-lettings-ltd" */
export const slugifyOrgName = (name = "") =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Resolve the organization a public form belongs to.
 *
 * Accepts either a slugified name or a raw ObjectId (handy for organizations
 * whose name is blank, and for links shared before a rename). If two
 * organizations slugify to the same string the oldest one wins — names are not
 * unique in the schema, so this is first-come-first-served by design.
 *
 * @param {string} slug
 * @returns {Promise<import("mongoose").Document|null>}
 */
export const findOrganizationBySlug = async (slug) => {
  if (!slug) return null;

  if (/^[0-9a-fA-F]{24}$/.test(slug)) {
    const byId = await Organization.findById(slug);
    if (byId) return byId;
  }

  const clean = slugifyOrgName(decodeURIComponent(slug));
  if (!clean) return null;

  // Each "-" stands for one or more non-alphanumerics in the stored name, and
  // the ends are loose so trailing punctuation ("Ltd.") still matches.
  const pattern = clean.split("-").map(escapeRegex).join("[^a-zA-Z0-9]+");

  return Organization.findOne({
    name: new RegExp(`^[^a-zA-Z0-9]*${pattern}[^a-zA-Z0-9]*$`, "i"),
  }).sort({ createdAt: 1 });
};

export default findOrganizationBySlug;
