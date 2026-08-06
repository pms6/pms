"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../Context/AuthContext";

const STEPS = ["Email", "Code", "New password"];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, verifyResetOtp, resetPassword } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);
  // Mirrors the server's 60s cooldown between codes.
  const [resendIn, setResendIn] = useState(0);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const code = otp.join("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const go = (n) => {
    setError("");
    setStep(n);
  };

  // ---- Step 0: request a code ----
  const submitEmail = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      // The reply is the same whether or not the address is registered, so we
      // always advance — an attacker learns nothing from where the flow stops.
      toast.success("If that email is registered, a reset code is on its way.");
      setResendIn(60);
      go(1);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not send the reset code."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 1: the 6-digit code ----
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

    if (code.length !== 6) {
      setError("Enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      // Checked but not spent — the code is consumed when the new password is
      // submitted, so a mistyped password doesn't force a fresh email.
      await verifyResetOtp({ email, otp: code });
      go(2);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Invalid or expired code."
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setResendIn(60);
      toast.success("A new code is on its way.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: choose a new password ----
  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");

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
      await resetPassword({ email, otp: code, password });
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || "Could not reset your password.";
      setError(message);
      // A dead code can't be rescued from this step — send them back for a new one.
      if (err.response?.status === 429 || /expired|Incorrect code/i.test(message)) {
        setOtp(["", "", "", "", "", ""]);
        setStep(1);
      }
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
                Account Recovery
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-bold leading-snug mb-3">
            Locked out?
            <br />
            Let&apos;s fix that.
          </h1>
          <p className="text-white/50 text-sm max-w-sm">
            We&apos;ll email you a 6-digit code to confirm it&apos;s you, then you can
            choose a new password.
          </p>

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
          <ShieldCheck size={14} /> Reset codes expire after 10 minutes.
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
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#F47C3C] flex items-center justify-center text-white">
              <Building2 size={20} />
            </div>
            <p className="font-bold text-lg text-[#0F253B]">PMS</p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-start gap-2">
              <X size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ===== Step 0: Email ===== */}
          {step === 0 && (
            <form onSubmit={submitEmail}>
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">
                Forgot your password?
              </h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Enter the email address on your account and we&apos;ll send you a reset
                code.
              </p>

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
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

              <SubmitButton loading={loading} label="Send reset code" />

              <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                Remembered it?{" "}
                <Link href="/login" className="text-[#F47C3C] font-bold hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}

          {/* ===== Step 1: Code ===== */}
          {step === 1 && (
            <form onSubmit={submitOtp}>
              <BackLink onClick={() => go(0)} />
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">Check your email</h2>
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

              <SubmitButton loading={loading} label="Continue" />

              <p className="mt-6 text-center text-xs text-gray-400 font-medium">
                Didn&apos;t get it?{" "}
                {resendIn > 0 ? (
                  <span className="text-gray-400 font-bold">
                    Resend code in {resendIn}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={loading}
                    className="text-[#F47C3C] font-bold hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </p>
            </form>
          )}

          {/* ===== Step 2: New password ===== */}
          {step === 2 && (
            <form onSubmit={submitPassword}>
              <BackLink onClick={() => go(1)} />
              <h2 className="text-2xl font-bold text-[#0F253B] mb-1">
                Choose a new password
              </h2>
              <p className="text-sm text-gray-400 font-medium mb-8">
                Pick something you haven&apos;t used before.
              </p>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>New Password</label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
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
                  <label className={labelClass}>Confirm New Password</label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`${inputClass} pl-11`}
                      placeholder="Re-enter your new password"
                      required
                    />
                  </div>
                </div>
              </div>

              <SubmitButton loading={loading} label="Reset password" icon={Check} />
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
