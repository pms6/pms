import mongoose from "mongoose";

// Where the inbox reader (cranjob/emailInbox.js) got up to in a mailbox, so
// each check only reads mail that arrived since the last one.
//
// IMAP UIDs only increase within one UIDVALIDITY; if the server resets it,
// the stored UID is meaningless and the reader starts again from a recent date.
const inboxSyncStateSchema = new mongoose.Schema(
  {
    // "<user>@<host>/<mailbox>"
    key: { type: String, required: true, unique: true },
    uidValidity: { type: String, default: "" },
    lastUid: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    lastResult: {
      replies: { type: Number, default: 0 },
      newConversations: { type: Number, default: 0 },
      ignored: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("InboxSyncState", inboxSyncStateSchema);
