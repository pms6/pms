"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Wifi, PhoneCall, Video, Trash2, Edit2, Eye, X, Building2, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary } from "@/app/utils/uploadToCloudinary";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function CardModal({ properties, initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    propertyId: "", title: "", description: "", wifiNetwork: "", 
    wifiPassword: "", emergencyNumber: "", videoUrl: "", documentUrl: "", documentName: ""
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (initialData) {
      // Extract target ID string safely, whether initialData.propertyId is a string or an object
      const extractedPropertyId = typeof initialData.propertyId === "object" && initialData.propertyId !== null
        ? initialData.propertyId._id
        : initialData.propertyId;

      setForm({
        propertyId: extractedPropertyId || "",
        title: initialData.title || "",
        description: initialData.description || "",
        wifiNetwork: initialData.wifiNetwork || "",
        wifiPassword: initialData.wifiPassword || "",
        emergencyNumber: initialData.emergencyNumber || "",
        videoUrl: initialData.videoUrl || "",
        documentUrl: initialData.documentUrl || "",
        documentName: initialData.documentName || ""
      });
      setFile(null);
    }
  }, [initialData]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.propertyId) return alert("Please map this card to a property!");
    setSaving(true);

    let updatedForm = { ...form };

    if (file) {
      setUploadingFile(true);
      try {
        const uploadResult = await uploadFileToCloudinary(file);
        updatedForm.documentUrl = uploadResult.url;
        updatedForm.documentName = uploadResult.name;
      } catch (err) {
        alert(`File upload failed: ${err.message}`);
        setSaving(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    try {
      await onSave(updatedForm, initialData?._id);
      onClose();
    } catch (err) {
      alert("Error saving Info Card configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{initialData ? "Update Info Card" : "New Information Card"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Link to Property Tenancy</label>
            <select className={FIELD} value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })} required>
              <option value="">Select Property</option>
              {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Card Header Title</label>
            <input type="text" className={FIELD} placeholder="e.g. Property Manual & Moving Guidelines" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>

          <div>
            <label className={LABEL}>Description Details</label>
            <textarea rows={3} className={FIELD} placeholder="Provide helpful instructions..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>

          <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>WiFi Network</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="BT-Hub5" value={form.wifiNetwork} onChange={(e) => setForm({ ...form, wifiNetwork: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>WiFi Password</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="wifi-pass" value={form.wifiPassword} onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>24/7 Call Number</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-[#0F253B]" placeholder="Emergency line" value={form.emergencyNumber} onChange={(e) => setForm({ ...form, emergencyNumber: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Utility Setup Video URL</label>
              <input type="url" className={FIELD} placeholder="YouTube URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Reference Documents</label>
              <div className="relative border border-dashed border-gray-200 bg-gray-50 rounded-xl p-2.5 text-center text-xs font-bold text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <input type="file" accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setFile(e.target.files[0])} />
                <span className="truncate block max-w-xs mx-auto">
                  {file ? file.name : form.documentName ? form.documentName : "Upload Document pack..."}
                </span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {uploadingFile ? "Uploading Attachments..." : "Saving Changes..."}
              </>
            ) : initialData ? (
              "Update Information Card"
            ) : (
              "Create Welcome Pack Card"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WelcomePack() {
  const [properties, setProperties] = useState([]);
  const [infoCards, setInfoCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState("All");
  const [modalState, setModalState] = useState({ open: false, data: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [propsRes, cardsRes] = await Promise.all([
        api.get("/properties", { params: { limit: 100 } }),
        api.get("/welcome-pack")
      ]);
      setProperties(propsRes.data.data || []);
      setInfoCards(cardsRes.data.data || []);
    } catch (err) {
      setError("Failed to load welcome pack data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveCard = async (payload, id) => {
    try {
      if (id) {
        await api.patch(`/welcome-pack/${id}`, payload);
      } else {
        await api.post("/welcome-pack", payload);
      }
      loadData();
    } catch (err) {
      alert("Error saving Info Card configuration");
    }
  };

  const deleteAsset = async (id) => {
    if (!confirm("Are you sure you want to permanently delete this resource component?")) return;
    try {
      await api.delete(`/welcome-pack/${id}`);
      loadData();
    } catch (err) {
      alert("Deletion error triggered.");
    }
  };

  // Extract ID string from populated object safely before filtering 
  const filteredCards = selectedPropertyFilter === "All" 
    ? infoCards 
    : infoCards.filter(c => {
        const cardPropertyId = typeof c.propertyId === "object" && c.propertyId !== null 
          ? c.propertyId._id 
          : c.propertyId;
        return cardPropertyId === selectedPropertyFilter;
      });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Digital Welcome Pack"
        subtitle="Configure property guidelines, parameters, and instruction cards securely accessed by specific tenancies."
        action={
          <button onClick={() => setModalState({ open: true, data: null })} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Info Card
          </button>
        }
      />

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Building2 size={14} className="text-[#F47C3C]" /> Filter View by Target Tenancy:
        </div>
        <select
          value={selectedPropertyFilter}
          onChange={(e) => setSelectedPropertyFilter(e.target.value)}
          className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none cursor-pointer focus:ring-1 focus:ring-[#F47C3C]"
        >
          <option value="All">All Registered Properties</option>
          {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        {loading ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">Loading modules...</div>
        ) : filteredCards.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 font-medium">No structured instruction cards active for this scope.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCards.map((card) => {
              // Extract property layout variables safely
              const isPopulated = typeof card.propertyId === "object" && card.propertyId !== null;
              const propertyName = isPopulated 
                ? card.propertyId.name 
                : (properties.find(p => p._id === card.propertyId)?.name || "Unknown Property");

              return (
                <div key={card._id} className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#F47C3C] bg-orange-50 px-2 py-0.5 rounded-md">
                        <Building2 size={10} /> {propertyName}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModalState({ open: true, data: card })} className="p-1 text-gray-300 hover:text-[#0F253B] rounded-md transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteAsset(card._id)} className="p-1 text-gray-300 hover:text-red-500 rounded-md transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-base text-[#0F253B]">{card.title}</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-3">{card.description}</p>
                    
                    <div className="pt-3 border-t border-gray-50 space-y-2 text-[11px] text-gray-600 font-medium">
                      {(card.wifiNetwork || card.wifiPassword) && (
                        <p className="flex items-center gap-1.5 text-gray-500">
                          <Wifi size={12} className="text-[#F47C3C]" /> 
                          Network: <strong className="text-[#0F253B]">{card.wifiNetwork}</strong> · Key: <code>{card.wifiPassword}</code>
                        </p>
                      )}
                      {card.emergencyNumber && (
                        <p className="flex items-center gap-1.5 text-gray-500">
                          <PhoneCall size={12} className="text-emerald-600" /> 
                          Support: <strong className="text-[#0F253B]">{card.emergencyNumber}</strong>
                        </p>
                      )}
                      {card.videoUrl && (
                        <a href={card.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Video size={12} /> Watch Video Resource Instruction
                        </a>
                      )}
                      {card.documentUrl && (
                        <a href={card.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-indigo-600 hover:underline">
                          <FileText size={12} /> View Document: {card.documentName || "Reference Pack"}
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-3 border-t border-gray-50 flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    <Eye size={12}/> Live in Tenant Hub
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalState.open && (
        <CardModal
          properties={properties}
          initialData={modalState.data}
          onClose={() => setModalState({ open: false, data: null })}
          onSave={saveCard}
        />
      )}
    </div>
  );
}