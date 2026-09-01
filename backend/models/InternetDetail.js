import mongoose from "mongoose";

// One broadband account, modelled on the "Internet Details" sheet the business
// already keeps: one row per property, grouped by provider.
//
// The sheet's "Sr. No" column is deliberately NOT stored. It restarts at 1 in
// each provider section, so a stored number would go stale the moment a row is
// added, removed or moved to another provider. It is numbered on the way out
// instead — see numberRows() in the controller.
//
// Providers seen on the sheet. Free text is still accepted (the list is a
// convenience, not a constraint) — MUST stay in sync with PROVIDERS in
// frontend/src/app/admin/internet/page.js.
export const INTERNET_PROVIDERS = [
  "Virgin Media",
  "Sky",
  "Community Fiber",
  "BT",
  "TalkTalk",
  "Plusnet",
  "Vodafone",
  "EE",
  "Hyperoptic",
  "Other",
];

// MUST stay in sync with PAYMENT_METHODS in the same page. Matches the values
// Expense already uses so the two sheets read the same way.
export const INTERNET_PAYMENT_METHODS = [
  "",
  "Direct Debit",
  "Bank Transfer",
  "Card",
  "Cash",
  "Cheque",
];

const internetDetailSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS Relationships
    // ============================
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ============================
    // Property (sheet column: Property Name)
    // ============================
    // Optional link to the property record, with the name denormalised so the
    // sheet renders and exports without populating every row — the same shape
    // Expense and Tenancy use.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    propertyName: { type: String, trim: true, required: true },

    // ============================
    // Account (Account# · Area Ref · Account Holder)
    // ============================
    accountNumber: { type: String, trim: true, default: "" },
    areaRef: { type: String, trim: true, default: "" },
    accountHolder: { type: String, trim: true, default: "" },

    // ============================
    // Provider (Provider Name, + the support number the sheet keeps in the
    // provider's section heading)
    // ============================
    providerName: { type: String, trim: true, required: true, index: true },
    providerPhone: { type: String, trim: true, default: "" },

    // ============================
    // Contract (Contract Start · Contract End · Amount · Payment Method)
    // ============================
    contractStart: { type: Date, default: null },
    contractEnd: { type: Date, default: null, index: true },

    // Monthly cost.
    amount: { type: Number, default: 0, min: 0 },

    paymentMethod: {
      type: String,
      enum: INTERNET_PAYMENT_METHODS,
      default: "",
    },

    // ============================
    // Billing (Company Name · Bank Name · Bank Details)
    // ============================
    companyName: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    // Multi-line on the sheet: account number, sort code and IBAN stacked in
    // one cell.
    bankDetails: { type: String, trim: true, default: "" },

    // ============================
    // Access (Security Question · User Name · Password)
    // ============================
    // Also multi-line — the sheet stores whatever the provider asks for
    // (memorable word, date of birth, address).
    securityQuestion: { type: String, trim: true, default: "" },
    userName: { type: String, trim: true, default: "" },
    // Stored as written, not hashed: this is a shared credentials register that
    // staff have to be able to read back, which is the whole point of the
    // sheet. The route is staff-only for that reason.
    password: { type: String, trim: true, default: "" },

    // ============================
    // Router (Router Location, + the photo of the router itself)
    // ============================
    routerLocation: { type: String, trim: true, default: "" },
    routerImage: {
      url: { type: String, default: "" },
      name: { type: String, default: "" },
    },

    // The sheet's last column carries no heading — it holds the email (and
    // sometimes phone) the account is registered against.
    accountEmail: { type: String, trim: true, default: "" },

    notes: { type: String, trim: true, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The sheet is always read whole, grouped by provider; the contract index backs
// the "expiring soon" summary.
internetDetailSchema.index({ organizationId: 1, isDeleted: 1, providerName: 1 });
internetDetailSchema.index({ organizationId: 1, contractEnd: 1 });

export default mongoose.model("InternetDetail", internetDetailSchema);
