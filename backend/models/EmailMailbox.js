import mongoose from "mongoose";

const emailMailboxSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    encryptedPassword: { type: String, required: true },
    passwordIv: { type: String, required: true },
    passwordTag: { type: String, required: true },
    initialSyncComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("EmailMailbox", emailMailboxSchema);
