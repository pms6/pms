import mongoose from "mongoose";

// Per-organisation running numbers — invoice numbers, inventory report and
// case references. One document per (organization, key), bumped with an atomic
// $inc, so two saves at the same moment can never be handed the same number
// (the highest-existing-code approach in utils/codes.js can, under a race).
const counterSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    key: { type: String, required: true, trim: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ organizationId: 1, key: 1 }, { unique: true });

const Counter = mongoose.model("Counter", counterSchema);

/** The next number in this organisation's `key` sequence, starting at 1. */
export const nextSeq = async (organizationId, key) => {
  const doc = await Counter.findOneAndUpdate(
    { organizationId, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return doc.seq;
};

/** "IR-000042" style reference from a prefix and a sequence number. */
export const formatRef = (prefix, seq, width = 6) => `${prefix}${String(seq).padStart(width, "0")}`;

export default Counter;
