"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Home,
  Building2,
  KeyRound,
  Mail,
  Lock,
  Calendar,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useAuth } from "../Context/AuthContext";
import uploadToCloudinary from "../utils/uploadToCloudinary";

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_SAY", label: "Prefer not to say" },
];

const STEPS = ["Purpose", "Account", "Verify", "Profile"];

// Derive the public-facing age range from a date of birth.
const ageRangeFromDob = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age < 18) return "Under 18";
  if (age <= 24) return "18–24";
  if (age <= 34) return "25–34";
  if (age <= 44) return "35–44";
  if (age <= 54) return "45–54";
  if (age <= 64) return "55–64";
  return "65+";
};

export default function TenantSignUpPage() {
  const router = useRouter();
  const { register, verifyOtp, updateProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 0 — purpose
  const [purpose, setPurpose] = useState(""); // "tenant" | "organization"
  const [inviteCode, setInviteCode] = useState("");

  // Step 1 — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Step 2 — otp
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);

  // Step 3 — profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const targetRole = purpose === "organization" ? "Organization" : "Tenant";
  const ageRange = useMemo(() => ageRangeFromDob(dob), [dob]);

  const go = (n) => {
    setError("");
    setStep(n);
  };

  // ---- Step 0: choose purpose ----
  const submitPurpose = () => {
    if (!purpose) {
      setError("Please choose how you'll be using the platform.");
      return;
    }
    go(1);
  };

  // ---- Step 1: create account (email + password) ----
  const submitAccount = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({ email, password, targetRole });
      toast.success("We've emailed you a 6-digit verification code.");
      go(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: verify OTP ----
  const handleOtpChange = (i, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let k = 0; k < text.length; k++) next[k] = text[k];
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const user = await verifyOtp({ email, otp: code, targetRole });
      if (user?.role === "tenant") {
        toast.success("Email verified. Let's set up your profile.");
        go(3);
      } else {
        toast.success("Account verified.");
        router.push("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await register({ email, password, targetRole });
      toast.success("A new code is on its way.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 3: profile picture handling ----
  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadNote("Please choose an image file.");
      return;
    }
    setImagePreview(URL.createObjectURL(file));
    setUploadNote("");
    setUploading(true);
    try {
      const { url } = await uploadToCloudinary(file);
      setImageUrl(url);
    } catch (err) {
      // Photo is optional — keep the local preview and let the user continue.
      setImageUrl("");
      setUploadNote("Couldn't upload the photo right now — it's optional, you can add it later.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const removeImage = () => {
    setImagePreview("");
    setImageUrl("");
    setUploadNote("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ---- Step 3: submit profile ----
  const submitProfile = async (e) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your forename and surname.");
      return;
    }
    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthdate: dob,
        gender,
        ...(imageUrl ? { profileImage: imageUrl } : {}),
      });
      toast.success("Welcome aboard! 🎉");
      router.push("/");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not save your profile.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:border-transparent focus:bg-white outline-none transition-all text-sm font-medium";
  const labelClass =
    "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1";

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC]">
      {/* ---------- Left brand / progress panel ---------- */}
      <aside className="hidden lg:flex w-[42%] max-w-[560px] flex-col justify-between bg-[#0F253B] text-white p-12 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "#F47C3C" }}
        />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full opacity-10 blur-3xl bg-white" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[#F47C3C] flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <p className="font-bold leading-tight text-lg">PMS</p>
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Account Setup
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-bold leading-snug mb-3">
            Find your next home,
            <br />
            the effortless way.
          </h1>
          <p className="text-white/50 text-sm max-w-sm">
            Create your account in a few steps and start discovering rooms and
            homes that fit your life.
          </p>

          {/* Step tracker */}
          <ol className="mt-14 space-y-5">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex items-center gap-4">
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                      done
                        ? "bg-[#F47C3C] border-[#F47C3C] text-white"
                        : active
                        ? "border-[#F47C3C] text-[#F47C3C] bg-white/5"
                        : "border-white/20 text-white/40"
                    }`}
                  >
                    {done ? <Check size={16} /> : i + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      active ? "text-white" : done ? "text-white/70" : "text-white/40"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="relative z-10 text-[11px] text-white/30 flex items-center gap-2">
          <ShieldCheck size={14} /> Your data is encrypted and GDPR-compliant.
        </p>
      </aside>

      {/* ---------- Right form panel ---------- */}
      <main className="flex-1 flex flex-col items-center justify-center p-5 sm:p-10">
        {/* Mobile step pills */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 rounded-full transition-all ${
                i <= step ? "bg-[#F47C3C] w-8" : "bg-gray-200 w-4"
              }`}
            />
          ))}
        </div>

        <div className="w-full max-w-[460px]">
          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-start gap-2">
              <X size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ===== Step 0: Purpose ===== */}
          {step === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">
                How will you use PMS?
              </h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Choose the option that fits you best.
              </p>

              <div className="space-y-4">
                {[
                  {
                    id: "organization",
                    icon: Building2,
                    title: "Property Management",
                    desc: "I manage properties, rooms, or tenancies.",
                  },
                  {
                    id: "tenant",
                    icon: Home,
                    title: "Looking to Find a Home",
                    desc: "I'm searching for a room or property to rent.",
                  },
                ].map(({ id, icon: Icon, title, desc }) => {
                  const selected = purpose === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPurpose(id)}
                      className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                        selected
                          ? "border-[#F47C3C] bg-orange-50/60 shadow-md shadow-orange-500/10"
                          : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          selected ? "bg-[#F47C3C] text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <Icon size={22} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#0F253B] text-sm">{title}</p>
                        <p className="text-xs text-gray-400 font-medium">{desc}</p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? "border-[#F47C3C] bg-[#F47C3C]" : "border-gray-300"
                        }`}
                      >
                        {selected && <Check size={12} className="text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <label className={labelClass}>Invitation Code (optional)</label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className={`${inputClass} pl-11`}
                    placeholder="Enter code to join an organisation"
                  />
                </div>
              </div>

              <button
                onClick={submitPurpose}
                className="mt-8 w-full py-4 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>

              <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                Already have an account?{" "}
                <Link href="/login" className="text-[#F47C3C] font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ===== Step 1: Account ===== */}
          {step === 1 && (
            <form onSubmit={submitAccount}>
              <BackLink onClick={() => go(0)} />
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">Create your account</h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Start with your email and a secure password.
              </p>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass} pl-11`}
                      placeholder="you@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pl-11 pr-11`}
                      placeholder="At least 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`${inputClass} pl-11`}
                      placeholder="Re-enter your password"
                      required
                    />
                  </div>
                </div>
              </div>

              <SubmitButton loading={loading} label="Send verification code" />
            </form>
          )}

          {/* ===== Step 2: Verify OTP ===== */}
          {step === 2 && (
            <form onSubmit={submitOtp}>
              <BackLink onClick={() => go(1)} />
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">Verify your email</h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Enter the 6-digit code we sent to{" "}
                <span className="text-[#0F253B] font-bold">{email}</span>.
              </p>

              <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-full aspect-square text-center text-xl font-bold bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:border-transparent focus:bg-white outline-none transition-all"
                  />
                ))}
              </div>

              <SubmitButton loading={loading} label="Verify" />

              <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                Didn't get it?{" "}
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="text-[#F47C3C] font-bold hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </p>
            </form>
          )}

          {/* ===== Step 3: Personal information ===== */}
          {step === 3 && (
            <form onSubmit={submitProfile}>
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">Personal information</h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Tell us a little about yourself to finish setting up.
              </p>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Forename</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Surname</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
                <p className="-mt-2 px-1 text-[11px] text-gray-400">
                  Your surname is kept private and never shown publicly.
                </p>

                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={dob}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDob(e.target.value)}
                      className={`${inputClass} pl-11`}
                      required
                    />
                  </div>
                  {ageRange && (
                    <p className="mt-2 px-1 text-[11px] text-gray-400">
                      Only your age range{" "}
                      <span className="font-bold text-[#0F253B]">{ageRange}</span> may be
                      shown on your public profile.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Gender</label>
                  <div className="grid grid-cols-2 gap-3">
                    {GENDERS.map((g) => {
                      const selected = gender === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setGender(g.value)}
                          className={`py-3 px-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                            selected
                              ? "border-[#F47C3C] bg-orange-50/60 text-[#0F253B]"
                              : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Profile Picture (optional)</label>
                  {imagePreview ? (
                    <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Profile preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0F253B] flex items-center gap-2">
                          {uploading ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Uploading…
                            </>
                          ) : imageUrl ? (
                            <>
                              <Check size={14} className="text-green-600" /> Ready
                            </>
                          ) : (
                            "Preview"
                          )}
                        </p>
                        {uploadNote && (
                          <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                            {uploadNote}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      onClick={() => fileRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                        dragging
                          ? "border-[#F47C3C] bg-orange-50/60"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-white shadow flex items-center justify-center text-[#F47C3C]">
                        <UploadCloud size={20} />
                      </div>
                      <p className="text-sm font-semibold text-[#0F253B]">
                        Drag & drop or <span className="text-[#F47C3C]">browse</span>
                      </p>
                      <p className="text-[11px] text-gray-400">PNG or JPG, up to 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </div>
              </div>

              <SubmitButton loading={loading || uploading} label="Complete setup" icon={Check} />
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- small presentational helpers ---------- */

function BackLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-[#0F253B] transition"
    >
      <ArrowLeft size={14} /> Back
    </button>
  );
}

function SubmitButton({ loading, label, icon: Icon = ArrowRight }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-8 w-full py-4 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-70 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <>
          {label} <Icon size={18} />
        </>
      )}
    </button>
  );
}
