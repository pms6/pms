import Tenancy from "../models/Tenancy.js";

/**
 * The tenancy already occupying `roomId`, if any.
 *
 * Active tenancies are the source of truth rather than `room.status`, because
 * the status flag drifts — a deleted tenancy can leave a room stuck OCCUPIED,
 * and a room can be marked AVAILABLE while a tenancy still points at it.
 *
 * @param {object}   args
 * @param {ObjectId} args.roomId
 * @param {ObjectId} args.organizationId
 * @param {ObjectId} [args.excludeTenancyId] tenancy being edited, so it doesn't clash with itself
 */
export const findRoomOccupant = async ({ roomId, organizationId, excludeTenancyId = null }) => {
  if (!roomId) return null;

  const filter = { roomId, organizationId, isDeleted: false };
  if (excludeTenancyId) filter._id = { $ne: excludeTenancyId };

  return Tenancy.findOne(filter)
    .select("_id tenant tenantEmail startDate unit")
    .lean();
};

/** Message shown when a room is already taken. */
export const roomTakenMessage = (occupant) =>
  `That room is already occupied by ${occupant.tenant || occupant.tenantEmail || "another tenant"}` +
  (occupant.startDate
    ? ` (since ${new Date(occupant.startDate).toLocaleDateString("en-GB")}).`
    : ".") +
  " End or remove that tenancy first.";
