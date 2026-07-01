import uploadToCloudinary from '@/app/utils/uploadToCloudinary';
import React from 'react';

export default function StepThree({ formData = {}, setFormData, onBack, onSubmit, loading }) {

  const priorityStyles = {
    Low: "bg-green-50 text-green-600 border-green-100",
    Routine: "bg-yellow-50 text-yellow-600 border-yellow-100",
    Urgent: "bg-red-50 text-red-600 border-red-100",
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files);

    const uploaded = [];

    for (const file of files) {
      const result = await uploadToCloudinary(file);
      uploaded.push(result.url);
    }

    setFormData({
      ...formData,
      photos: [...(formData.photos || []), ...uploaded],
    });
  };

  const handleRemovePhoto = (index) => {
    const updated = formData.photos.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      photos: updated,
    });
  };

  // 1. Updated InfoRow: Values are right-aligned on desktop per screenshot
  const InfoRow = ({ label, value, isBold = false }) => (
    <div className="flex justify-between items-center py-3 md:py-4 border-b border-gray-100 last:border-0">
      <span className="text-gray-400 text-sm font-medium">{label}</span>
      <span className={`text-sm ${isBold ? 'font-bold text-slate-900' : 'text-slate-600'} text-right`}>
        {value || '—'}
      </span>
    </div>
  );

  // 2. Updated SectionWrapper: Removes borders and backgrounds on desktop (md:)
  const SectionWrapper = ({ title, children }) => (
    <section className="md:pt-4">
      {/* Mobile: Colored header | Desktop: Simple uppercase text */}
      <div className="bg-[#FFF9F6] md:bg-transparent p-3 md:p-0 md:pb-4 rounded-t-xl border-x border-t border-orange-100 md:border-0">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-gray-500 md:text-gray-400">
          {title}
        </h3>
      </div>
      {/* Mobile: Bordered card | Desktop: Just the content */}
      <div className="bg-white md:bg-transparent p-4 md:p-0 border-x border-b border-orange-100 md:border-0 rounded-b-xl mb-6 md:mb-0">
        {children}
      </div>
    </section>
  );

  return (
      <>
        <div className="max-w-4xl mx-auto md:mb-10 md:border md:border-[#E8E4DF] md:shadow-lg md:rounded-xl overflow-hidden">
          {/* Desktop uses standard padding, Mobile uses p-4 */}
          <div className="p-0 md:p-8 space-y-6 md:space-y-10">
            
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">Review your repair report</h2>
              <p className="text-sm text-gray-500">
                Please check all details before submitting. Once submitted, our team will be notified immediately.
              </p>
            </div>

            {/* Section: Problem Category */}
            <SectionWrapper title="Problem Category">
              <div className="flex justify-between items-center py-3 md:py-5 border-b border-gray-100">
                <span className="text-gray-400 text-sm font-medium">Category</span>
                <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-lg text-sm font-bold border border-orange-100 flex items-center gap-2">
                  <span>{formData.category || '🛠️'}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-3 md:py-5 border-b border-gray-100">
                <span className="text-gray-400 text-sm font-medium">Priority</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 
                  ${priorityStyles[formData.priority] || "bg-gray-50 text-gray-600 border-gray-100"}`}
                >
                  {formData.priority}
                </span>
              </div>
              <InfoRow label="Issue started" value={formData.issueStarted} />
            </SectionWrapper>

            {/* Section: Description */}
            <SectionWrapper title="Description">
              <div className="py-2 md:py-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {formData.description || "The bedroom door lock is broken and will not turn. This started yesterday evening."}
                </p>
              </div>
            </SectionWrapper>

            {/* Section: Your Details */}
            <SectionWrapper title="Your Details">
              <InfoRow label="Best contact time" value={formData.contactTime || 'Anytime'} isBold />
              <InfoRow label="Access" value={formData.access || 'Yes — someone is always home'} isBold />
            </SectionWrapper>

            {/* Section: Photos */}
            <SectionWrapper title="Photos Attached">
              <div className="flex flex-col gap-4 py-2">

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">

                  {formData.photos?.map((photo, index) => (
                    <div
                      key={index}
                      className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 group"
                    >
                      <img
                        src={typeof photo === "string" ? photo : photo.url}
                        alt="repair"
                        className="w-full h-full object-cover"
                      />

                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 bg-black/60 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Upload Box */}
                  <label className="w-full aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300 text-xl cursor-pointer hover:border-orange-400 hover:text-orange-400 transition">
                    +
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleAddPhotos}
                      className="hidden"
                    />
                  </label>

                </div>

                <p className="text-[11px] text-gray-400">
                  {formData.photos?.length || 0} photos attached · Minimum 10 required
                </p>

              </div>
            </SectionWrapper>

            {/* Footer Confirmation Box */}
            <div className="space-y-6 pt-4">
              <div className="bg-[#FFF9F6] border border-orange-100 rounded-2xl p-6">
                <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                  By submitting this repair request you confirm the information provided is accurate. Rentaroomlondon may contact you to arrange access. 
                  <br className="hidden md:block" />
                  For emergencies, please call our dedicated line. Read our <span className="text-orange-600 font-bold cursor-pointer">Repairs Policy</span> and <span className="text-orange-600 font-bold cursor-pointer">Privacy Statement</span>.
                </p>
              </div>

              <div className="flex items-center gap-3 px-1">
                <input 
                  type="checkbox" 
                  id="confirm" 
                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500" 
                />
                <label htmlFor="confirm" className="text-xs font-medium text-slate-500">
                  I confirm the details above are correct and I agree to Rentaroomlondon arranging access to the property to carry out the repair.
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 md:pt-0">
              <button 
                onClick={onSubmit}
                disabled={loading || (formData.photos?.length || 0) < 10}
                className={`w-full text-[12px] md:text-[16px] font-sans text-white font-bold py-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide
                  ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 shadow-orange-200"}
                `}
              >

                {loading ? (
                  <>
                    {/* 🔥 Spinner */}
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    🔧 SUBMIT REPAIR REQUEST
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </>
                )}

              </button>
              
              {/* MOBILE ONLY FOOTER */}
              <div className="md:hidden flex items-center justify-between mt-8">
                <button onClick={onBack} className="bg-white px-5 py-2.5 border border-gray-100 rounded-xl font-bold text-[#475569] uppercase text-[10px] flex items-center gap-2 ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  BACK TO DETAILS
                </button>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Step 3 of 3</span>
              </div>
            </div>
            
          </div>
        </div>

        {/* This container will be hidden on mobile (default) and flex on desktop (md:) */}
        <div className="hidden md:block pt-4 mb-4 border-t border-t-[#E8E4DF]">
          <div className="hidden md:flex items-center justify-between">
            <button 
              onClick={onBack}
              className="px-8 py-3.5 border border-gray-200 rounded-xl font-bold text-slate-500 bg-white text-xs flex items-center gap-3 hover:bg-gray-50 transition "
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              BACK TO DETAILS
            </button>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">
              Step 3 of 3
            </span>
          </div>
        </div>
    </>
  );
}