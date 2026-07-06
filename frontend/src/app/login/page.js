"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../Context/AuthContext";

export default function TenantLoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Send the user back to the home page — the header reflects their
      // signed-in state (name + avatar) from there.
      router.push("/");
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Invalid email or password."
      );
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
      {/* ---------- Left brand panel ---------- */}
      <aside className="hidden lg:flex w-[42%] max-w-[560px] flex-col justify-between bg-[#0F253B] text-white p-12 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "#F47C3C" }}
        />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full opacity-10 blur-3xl bg-white" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F47C3C] flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <p className="font-bold leading-tight text-lg">PMS</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Tenant Portal
            </p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-snug mb-3">Welcome back.</h1>
          <p className="text-white/50 text-sm max-w-sm">
            Sign in to manage your tenancy, payments, maintenance requests and
            everything about your home — all in one place.
          </p>
        </div>

        <p className="relative z-10 text-[11px] text-white/30 flex items-center gap-2">
          <ShieldCheck size={14} /> Secure, encrypted &amp; GDPR-compliant.
        </p>
      </aside>

      {/* ---------- Right form panel ---------- */}
      <main className="flex-1 flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#F47C3C] flex items-center justify-center text-white">
              <Building2 size={20} />
            </div>
            <p className="font-bold text-lg text-[#0F253B]">PMS</p>
          </div>

          <h2 className="text-2xl font-bold text-[#0F253B] mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 font-medium mb-8">
            Enter your credentials to continue.
          </p>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-lg flex items-start gap-2">
              <X size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-70 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400 font-medium">
            Don&apos;t have an account?{" "}
            <Link href="/tenant-signup" className="text-[#F47C3C] font-bold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
