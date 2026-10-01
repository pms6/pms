"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Check, Receipt } from "lucide-react";
import api from "@/app/api/api";

// The company and payment details printed on invoices (and the email on the
// cover of inventory reports). Name, address, phone and logo come from the
// organisation form above; these are the extras. Saved through the same
// PATCH /auth/organization, under `invoiceSettings`.
const FIELDS = [
  ["prefix", "Invoice number prefix", "INV-"],
  ["email", "Accounts / contact email", "accounts@yourcompany.co.uk"],
  ["website", "Website", "www.yourcompany.co.uk"],
  ["vatNumber", "VAT number", "GB123456789"],
  ["companyNumber", "Company number", "12345678"],
  ["bankName", "Bank", "Barclays"],
  ["accountName", "Account name", "Your Company Ltd"],
  ["sortCode", "Sort code", "20-00-00"],
  ["accountNumber", "Account number", "12345678"],
  ["iban", "IBAN", ""],
  ["swift", "SWIFT / BIC", ""],
];

export default function InvoiceSettingsForm({ inputClass, labelClass }) {
  const [form, setForm] = useState({ defaultVatRate: 0, paymentTermsDays: 14, paymentInstructions: "", footer: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        const org = res.data?.profile || res.data?.organization;
        if (org?.invoiceSettings) setForm((f) => ({ ...f, ...org.invoiceSettings }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch("/auth/organization", { invoiceSettings: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save invoice details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-gray-100 rounded-3xl p-6 space-y-5 max-w-3xl">
      <div>
        <h2 className="text-base font-bold text-[#0F253B] flex items-center gap-2">
          <Receipt size={17} className="text-[#F47C3C]" /> Invoice &amp; company details
        </h2>
        <p className="text-xs text-gray-400 font-medium">
          Printed on every invoice. Your company name, address, phone and logo come from the details above.
        </p>
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#F47C3C]" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map(([k, label, ph]) => (
              <div key={k}>
                <label className={labelClass}>{label}</label>
                <input className={inputClass} value={form[k] || ""} onChange={set(k)} placeholder={ph} />
              </div>
            ))}
            <div>
              <label className={labelClass}>Default VAT rate (%)</label>
              <input type="number" min="0" max="100" step="any" className={inputClass} value={form.defaultVatRate ?? 0} onChange={set("defaultVatRate")} />
            </div>
            <div>
              <label className={labelClass}>Payment terms (days)</label>
              <input type="number" min="0" className={inputClass} value={form.paymentTermsDays ?? 14} onChange={set("paymentTermsDays")} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment instructions</label>
            <textarea className={inputClass} rows={2} value={form.paymentInstructions || ""} onChange={set("paymentInstructions")} placeholder="Please pay by bank transfer quoting the invoice number." />
          </div>
          <div>
            <label className={labelClass}>Invoice footer</label>
            <input className={inputClass} value={form.footer || ""} onChange={set("footer")} placeholder="Your Company Ltd · Registered in England & Wales No. 12345678" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#F47C3C] hover:bg-[#e06d30] disabled:bg-gray-400 text-white font-bold text-sm rounded-xl w-full md:w-auto"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : <Save size={18} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save invoice details"}
          </button>
        </>
      )}
    </form>
  );
}
