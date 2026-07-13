"use client";

import { useState, useEffect } from "react";
import { Save, Check, Loader2, Upload, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";

export default function AdminSettings() {
  const { organization } = useAuth();

  const [form, setForm] = useState({
    name: "",
    type: "AGENCY",
    businessType: "BUSINESS",
    legalName: "",
    phone: "",
    address: "",
    logo: "",
    units: 0,
    planType: "MONTHLY",
    fastTrack: false,
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  // Populate form from AuthContext or fallback
  useEffect(() => {
    if (organization) {
      const orgLogo = organization.logo || "";
      setForm({
        name: organization.name || "",
        type: organization.type || "AGENCY",
        businessType: organization.businessType || "BUSINESS",
        legalName: organization.legalName || "",
        phone: organization.phone || "",
        address: organization.address || "",
        logo: orgLogo,
        units: organization.units ?? 0,
        planType: organization.planType || "MONTHLY",
        fastTrack: organization.fastTrack || false,
      });
      setLogoPreview(orgLogo);
    } else {
      const fetchOrganization = async () => {
        try {
          const res = await api.get("/auth/me");
          const org = res.data?.profile || res.data?.organization;
          if (org) {
            const orgLogo = org.logo || "";
            setForm({
              name: org.name || "",
              type: org.type || "AGENCY",
              businessType: org.businessType || "BUSINESS",
              legalName: org.legalName || "",
              phone: org.phone || "",
              address: org.address || "",
              logo: orgLogo,
              units: org.units ?? 0,
              planType: org.planType || "MONTHLY",
              fastTrack: org.fastTrack || false,
            });
            setLogoPreview(orgLogo);
          }
        } catch (err) {
          console.error("Failed to load organization data:", err);
        }
      };
      fetchOrganization();
    }
  }, [organization]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setSaved(false);
    setError("");
  };

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const result = await uploadToCloudinary(file);
      
      // Update form and show preview instantly
      setForm((prev) => ({ ...prev, logo: result.url }));
      setLogoPreview(result.url);
      
    } catch (err) {
      setError(err.message || "Failed to upload logo");
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset file input
    }
  };

  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logo: "" }));
    setLogoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.patch("/auth/organization", form);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      console.log("✅ Organization updated:", res.data.organization);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to update organization";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";

  const labelClass =
    "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Account Settings" subtitle="Organisation profile and plan" />

      {/* Organization Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5"
      >
        {saved && (
          <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-bold rounded flex items-center gap-2">
            <Check size={18} /> Organization updated successfully
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        {/* Logo Upload Section */}
        <div>
          <label className={labelClass}>Organization Logo</label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-6 py-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all active:scale-[0.98]">
                  <Upload size={18} />
                  <span className="text-sm font-medium">Upload New Logo</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>

              {logoPreview && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-2">
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="h-16 w-16 object-contain rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove logo"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            {uploading && (
              <p className="text-sm text-gray-500 flex items-center gap-2 pl-1">
                <Loader2 size={16} className="animate-spin" />
                Uploading to Cloudinary...
              </p>
            )}

            {form.logo && !logoPreview && (
              <p className="text-xs text-gray-500 break-all pl-1">
                Current Logo: {form.logo}
              </p>
            )}
          </div>
        </div>

        {/* Other Fields */}
        <div>
          <label className={labelClass}>Organization Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Organization Type</label>
            <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
              <option value="AGENCY">Agency</option>
              <option value="LANDLORD">Landlord</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Business Type</label>
            <select
              name="businessType"
              value={form.businessType}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="BUSINESS">Business</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Legal Name</label>
          <input
            name="legalName"
            value={form.legalName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Plan Type</label>
            <select
              name="planType"
              value={form.planType}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="number"
            name="units"
            value={form.units}
            onChange={handleChange}
            className={`${inputClass} w-32`}
          />
          <span className="text-sm text-gray-500">Units / Properties</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="fastTrack"
            checked={form.fastTrack}
            onChange={handleChange}
            className="w-5 h-5 accent-[#F47C3C]"
          />
          <label className="text-sm font-medium cursor-pointer">Enable Fast Track</label>
        </div>

        <button
          type="submit"
          disabled={loading || uploading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#F47C3C] hover:bg-[#e06d30] disabled:bg-gray-400 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] w-full md:w-auto mt-4"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {loading ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}