'use client';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { CheckCircle2 } from 'lucide-react';
import api from '@/app/api/api';
import StepOne from './StepOne';
import StepTwo from './StepTwo';
import StepThree from './StepThree';

// Map the form's priority labels to the backend enum.
const PRIORITY_MAP = { Low: 'low', Routine: 'med', Urgent: 'urgent' };

export default function MaintenanceForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    priority: 'Routine',
    description: '',
    issueStarted: '',
    contactTime: 'Anytime',
    access: 'Yes — someone is always home',
    photos: []
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  // Helper to get labels based on step
  const stepLabels = ["Select Problem", "Add Details", "Confirm & Submit"];

  const resetForm = () => {
    setFormData({
      category: '',
      priority: 'Routine',
      description: '',
      issueStarted: '',
      contactTime: 'Anytime',
      access: 'Yes — someone is always home',
      photos: [],
    });
    setStep(1);
    setSubmitted(false);
  };

  // ✅ SUBMIT API — create the maintenance request for the signed-in tenant.
  // The backend stamps the tenant's property/room/name automatically.
  const submitMaintenance = async () => {
    // Collect resolved photo URLs (skip any local blob previews still uploading).
    const photoUrls = (formData.photos || [])
      .map((p) => (typeof p === 'string' ? p : p?.url))
      .filter((u) => u && !u.startsWith('blob:'));

    // Fold the extra contact fields into the description (the model has no
    // dedicated columns for them).
    const detail = [
      formData.description,
      formData.contactTime ? `Best time to call: ${formData.contactTime}` : '',
      formData.access ? `Access: ${formData.access}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    setLoading(true);
    try {
      await api.post('/maintenance', {
        title: formData.category || 'Maintenance request',
        category: formData.category || 'General',
        description: detail,
        priority: PRIORITY_MAP[formData.priority] || 'med',
        image: photoUrls[0] || '',
        ...(formData.issueStarted ? { date: formData.issueStarted } : {}),
      });
      setSubmitted(true);
      toast.success('Your maintenance request has been submitted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 md:px-15 md:py-10 max-w-[1440px] mx-auto">
        <div className="max-w-md mx-auto text-center bg-white border border-[#E8E4DF] rounded-2xl p-8 md:p-10 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#0F253B]">Request submitted</h2>
          <p className="mt-2 text-sm text-[#6B7280]">
            Thanks — your operator has been notified and will be in touch to arrange the repair.
          </p>
          <button
            onClick={resetForm}
            className="mt-6 w-full py-3 bg-[#F47C3C] hover:bg-[#e85e2f] text-white font-bold rounded-xl transition"
          >
            Report another issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:px-15 md:py-5 max-w-[1440px] mx-auto">

      {/* Progress Bar Container */}
      <div className="relative md:mb-8 pb-4 md:pb-8 md:border-b border-gray-200">
        
        {/* --- DESKTOP VIEW (Visible on md and up) --- */}
        <div className="hidden md:block">
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-gray-200"></div>
          <div
            className="absolute top-4 left-0 h-[2px] bg-[#18B26A] transition-all duration-300"
            style={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
          ></div>

          <div className="relative flex justify-between items-center">
            {/* STEP 1 */}
            <div className="flex items-center gap-3 bg-[#f8fafc] pr-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${step >= 1 ? "bg-[#18B26A]" : "bg-gray-200"}`}>1</div>
              <span className={`font-semibold text-sm ${step >= 1 ? "text-[#18B26A]" : "text-gray-400"}`}>Select Problem</span>
            </div>

            {/* STEP 2 */}
            <div className="flex items-center gap-3 bg-[#f8fafc] pr-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${step === 2 ? "bg-[#F27438]" : step > 2 ? "bg-[#18B26A]" : "bg-gray-200"}`}>2</div>
              <span className={`font-semibold text-sm ${step === 2 ? "text-[#F27438]" : step > 2 ? "text-[#18B26A]" : "text-gray-400"}`}>Add Details</span>
            </div>

            {/* STEP 3 */}
            <div className="flex items-center gap-3 bg-[#f8fafc] pl-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${step === 3 ? "bg-[#F27438]" : "bg-gray-200"}`}>3</div>
              <span className={`font-semibold text-sm ${step === 3 ? "text-[#F27438]" : "text-gray-400"}`}>Confirm & Submit</span>
            </div>
          </div>
        </div>

        {/* --- MOBILE VIEW (Visible on small screens) --- */}
        <div className="md:hidden flex flex-col items-start w-full">
          <div className="flex items-center w-full relative h-8 mb-4">
             {/* Background Line */}
             <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-200 -translate-y-1/2"></div>
             {/* Progress Line */}
             <div 
                className="absolute top-1/2 left-0 h-[2px] bg-[#18B26A] -translate-y-1/2 transition-all duration-300"
                style={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
             ></div>
             
             {/* Circles */}
             <div className="relative flex justify-between w-full">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                      step === s
                        ? "bg-[#F27438] text-white"       // current step
                        : step > s
                        ? "bg-[#18B26A] text-white"       // completed step
                        : "bg-[#E5E7EB] text-gray-500"    // upcoming step
                    }`}
                  >
                    {s}
                  </div>
                ))}
              </div>
          </div>
          <h2 className="text-[#0F253B] font-bold text-lg">
            Step {step}/3 — {stepLabels[step - 1]}
          </h2>
        </div>
      </div>

      {/* Form Content */}
      <main>
        {step === 1 && <StepOne formData={formData} setFormData={setFormData} onNext={nextStep} />}
        {step === 2 && <StepTwo formData={formData} setFormData={setFormData} onNext={nextStep} onBack={prevStep} />}
        {step === 3 && <StepThree formData={formData} setFormData={setFormData} onBack={prevStep} onSubmit={submitMaintenance} loading={loading}/>}
      </main>
    </div>
  );
}