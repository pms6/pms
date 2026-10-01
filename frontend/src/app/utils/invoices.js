// Invoice vocabulary and the same totals maths the server uses, so the form
// can show a live total. The server recalculates on save and its figures are
// the ones stored. MUST stay in sync with backend/models/Invoice.js and
// computeTotals in backend/controllers/invoice.controller.js.

export const INVOICE_STATUSES = ["Draft", "Issued", "Paid", "Partially Paid", "Overdue", "Cancelled"];
export const BILL_TO_TYPES = ["Tenant", "Landlord", "Other"];

export const INVOICE_STATUS_TONE = {
  Draft: "gray",
  Issued: "blue",
  Paid: "green",
  "Partially Paid": "amber",
  Overdue: "red",
  Cancelled: "gray",
};

export const PAYMENT_METHODS = ["Bank Transfer", "Card", "Cash", "Cheque", "Direct Debit", "Deducted from Deposit", "Other"];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const lineNet = (li) => num(li.quantity) * num(li.unitPrice);

export const computeTotals = ({ lineItems = [], discountType = "amount", discountValue = 0, payments = [] }) => {
  const nets = lineItems.map(lineNet);
  const subtotal = round2(nets.reduce((a, b) => a + b, 0));
  const raw = discountType === "percent" ? (subtotal * num(discountValue)) / 100 : num(discountValue);
  const discountAmount = round2(Math.min(Math.max(raw, 0), Math.max(subtotal, 0)));
  const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
  const vatTotal = round2(lineItems.reduce((s, li, i) => s + (nets[i] * num(li.vatRate)) / 100, 0) * ratio);
  const total = round2(subtotal - discountAmount + vatTotal);
  const amountPaid = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  return { subtotal, discountAmount, vatTotal, total, amountPaid, balance: round2(Math.max(total - amountPaid, 0)) };
};

export const gbp = (n) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n) || 0);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
