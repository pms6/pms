"use client"
import uploadToCloudinary from '@/app/utils/uploadToCloudinary';
import React, { useState } from 'react';
import { toast } from 'react-toastify';

export default function StepTwo({ formData, setFormData, onNext, onBack }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const priorities = [
    { label: "Low", color: "bg-green-500", sub: "Not affecting daily life" },
    { label: "Routine", color: "bg-yellow-400", sub: "Needs attention soon" },
    { label: "Urgent", color: "bg-red-500", sub: "Safety or living affected" },
  ];

  const cardContainerStyle = "bg-white rounded-2xl border border-[#E8E4DF] shadow-sm mb-5 overflow-hidden md:border-none md:shadow-none md:mb-8 md:rounded-none";
  const sectionHeaderStyle = "bg-[#FFF9F5] p-4 border-b border-[#E8E4DF] md:bg-transparent md:p-0 md:border-none md:mb-4";
  // Reusable Button Component with "Smart Folding" for small screens
  const FooterButtons = ({ containerClass }) => (
  /* Removed flex-col and xs: prefixes to force a single row on all screens */
  <div className={`${containerClass} flex flex-row justify-between items-center gap-2`}>
    <button
      onClick={onBack}
      /* Added flex-1 on mobile for equal width or keep w-auto for natural size */
      className="px-4 py-3 md:px-6 border border-[#E8E4DF] rounded-xl font-bold text-gray-600 bg-white text-[10px] md:text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition "
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      BACK
    </button>
    
    <button
      onClick={handleNext}
      /* Removed w-full to prevent stacking; added md:w-[280px] for desktop consistency */
      className="px-4 py-3 md:px-10 md:py-4 bg-[#F47C3C] text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-[10px] md:text-sm whitespace-nowrap transition hover:bg-[#e85e2f] active:scale-[0.98]"
    >
      NEXT: REVIEW & CONFIRM 
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </button>
  </div>
);

  const handleNext = () => {
    if (!formData.description || !formData.description.trim()) {
      toast.info("Please describe the problem before continuing.");
      return;
    }

    onNext();
  };

  const uploadFiles = async (files) => {
    try {
      setUploading(true);

      for (const file of files) {
        // 👇 temporary preview (instant UI)
        const tempUrl = URL.createObjectURL(file);

        const tempId = Date.now() + Math.random();

        // add temporary loading image
        setFormData((prev) => ({
          ...prev,
          photos: [
            ...(prev.photos || []),
            { url: tempUrl, loading: true, id: tempId },
          ],
        }));

        // upload to cloudinary
        const result = await uploadToCloudinary(file);

        // replace temp with real image
        setFormData((prev) => ({
          ...prev,
          photos: prev.photos.map((p) =>
            p.id === tempId
              ? { url: result.url, loading: false, id: tempId }
              : p
          ),
        }));
      }
    } catch (error) {
      console.error(error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    const updated = [...formData.photos];
    updated.splice(index, 1);

    setFormData({
      ...formData,
      photos: updated,
    });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    await uploadFiles(files);
  };

  return (
    <div className="pb-8">
      <div className="max-w-4xl mx-auto"> {/* Removed md:p-9 here to move buttons outside */}
        
        {/* WHITE FORM CONTAINER */}
        <div className="md:p-9 md:bg-white md:rounded-2xl md:border md:border-[#E8E4DF] md:shadow-lg">
          
          {/* 1. Category Top Bar (Mobile Only) */}
          <div className="bg-[#FFF9F5] p-3 rounded-xl border border-[#FDEEE3] flex justify-between items-center mb-5 md:hidden">
            <div className="flex items-center gap-2">
              <span className="text-base">🚪</span>
              <span className="text-[#F47C3C] font-bold text-xs uppercase tracking-wider">{formData.category}</span>
            </div>
            <button onClick={onBack} className="text-[#F47C3C] text-xs font-bold underline">Change</button>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:block mb-8">
            <h2 className="text-2xl text-[#0F253B] font-bold">Tell us more about the issue</h2>
            <p className="text-[#6B7280] text-sm mt-1">
              Please fill in as much detail as possible to help our maintenance team.
            </p>
          </div>

          {/* 2. Urgency Card */}
          <div className={cardContainerStyle}>
            <div className={sectionHeaderStyle}>
              <h3 className="text-sm font-bold text-[#0F253B] flex items-center gap-2 uppercase tracking-tight">
                <span className="text-orange-400 md:hidden">⚡</span> How urgent is this?
              </h3>
            </div>
            <div className="p-4 md:p-1">
              <div className="grid grid-cols-3 gap-3">
                {priorities.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.label })}
                    className={`p-4 border rounded-xl text-center transition flex flex-col items-center justify-center
                    ${formData.priority === p.label ? "border-red-400 bg-red-50 ring-1 ring-red-400" : "border-[#E8E4DF] bg-white"}`}
                  >
                    <div className={`w-3 h-3 rounded-full mb-2 ${p.color}`} />
                    <div className="font-bold text-[#0F253B] text-[11px] md:text-[14px]">{p.label}</div>
                    <div className="text-[9px] text-gray-500 leading-tight mt-1 md:text-[11px]">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Problem Description Card */}
          <div className={cardContainerStyle}>
            <div className={sectionHeaderStyle}>
              <h3 className="text-sm font-bold text-[#0F253B] flex items-center gap-2 uppercase tracking-tight">
                <span className="md:hidden">📝</span> Describe the problem
              </h3>
            </div>
            <div className="p-4 md:p-1 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] uppercase mb-1 block">What's wrong? *</label>
                <textarea
                  className="w-full border border-[#E8E4DF] rounded-lg p-3 h-28 text-sm focus:ring-1 focus:ring-orange-400 outline-none placeholder:text-gray-300"
                  placeholder="e.g. The bedroom door lock is broken..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6B7280] uppercase mb-1 block">When did it start?</label>
                <input
                  type="date"
                  className="w-full border border-[#E8E4DF] rounded-lg p-3 text-sm focus:ring-1 focus:ring-orange-400 outline-none bg-white"
                  value={formData.issueStarted}
                  onChange={(e) => setFormData({ ...formData, issueStarted: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* 4. Details Card */}
          <div className={cardContainerStyle}>
            <div className={sectionHeaderStyle}>
              <h3 className="text-sm font-bold text-[#0F253B] flex items-center gap-2 uppercase tracking-tight">
                <span className="md:hidden">👤</span> Your details
              </h3>
            </div>
            <div className="p-4 md:p-1 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-bold text-[#6B7280] uppercase mb-1 block">Best time to call</label>
                   <input
                      type="time"
                      className="w-full border border-[#E8E4DF] rounded-lg p-3 text-sm"
                      value={formData.contactTime}
                      onChange={(e) =>
                        setFormData({ ...formData, contactTime: e.target.value })
                      }
                    />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-[#6B7280] uppercase mb-1 block">Access?</label>
                   <input 
                     type="text" 
                     className="w-full border border-[#E8E4DF] rounded-lg p-3 text-sm " 
                     value={formData.access} 
                     onChange={(e) => setFormData({ ...formData, access: e.target.value })} 
                   />
                 </div>
              </div>
            </div>
          </div>

          {/* 5. Photos Card */}
          <div className={cardContainerStyle}>
            <div className={sectionHeaderStyle}>
              <h3 className="text-sm font-bold text-[#0F253B] flex items-center gap-2 uppercase tracking-tight">
                <span className="md:hidden">📷</span> Add photos
              </h3>
            </div>
            <div className="p-4 md:p-1">
              <div className="space-y-4">

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
                  ${dragActive ? "border-orange-500 bg-orange-50" : "border-[#E8E4DF] bg-white"}`}
                >

                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="photoUpload"
                  />

                  <label htmlFor="photoUpload" className="cursor-pointer block">
                    
                    <span className="text-3xl">📸</span>

                    <p className="text-xs font-bold text-[#0F253B] mt-2">
                      {uploading ? "Uploading..." : "Drag & Drop or Click to Upload"}
                    </p>

                    <p className="text-[9px] text-gray-400">
                      JPG, PNG, HEIC · Max 10MB each
                    </p>

                  </label>

                </div>

                {/* Preview Uploaded Photos */}
                {formData.photos?.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">

                    {formData.photos.map((photo, index) => (
                      <div key={index} className="relative group">

                        {/* Image */}
                        <img
                          src={photo.url || photo}
                          alt="uploaded"
                          className={`w-full h-24 object-cover rounded-lg transition 
                            ${photo.loading ? "opacity-50 blur-sm" : "opacity-100"}`}
                        />

                        {/* 🔥 Loading overlay */}
                        {photo.loading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}

                        {/* Remove button */}
                        {!photo.loading && (
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                            ✕
                          </button>
                        )}

                      </div>
                    ))}

                  </div>
                )}

              </div>
            </div>
          </div>

          {/* MOBILE FOOTER (Inside white box, hidden on desktop) */}
          <FooterButtons containerClass="md:hidden mt-8" />
        </div>

        

      </div>
      <div className="hidden md:block border-t border-[#E8E4DF] mt-14">
        {/* Desktop Footer (outside white box) */}
        <FooterButtons containerClass="flex mt-8" />
      </div>
    </div>
  );
}