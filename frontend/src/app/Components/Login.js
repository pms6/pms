"use client";
import React, { useState } from "react";
import { useAuth } from "../Context/AuthContext"; // Swapped to your active token auth context
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginForm({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth(); // Extracted the corrected login handler
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Fire the dedicated login function from your AuthProvider
      // This hits '/auth/login' via your custom Axios setup and saves tokens
      const user = await login(email, password);

        switch (user.role) {
        case "admin":
            router.push("/admin/dashboard");
            break;

        case "manager":
            router.push("/manager/dashboard");
            break;

        case "agent":
            router.push("/agent/dashboard");
            break;

        case "finance":
            router.push("/finance/dashboard");
            break;

        case "tenant":
            router.push("/tenant/dashboard");
            break;

        default:
            router.push("/");
        }

    } catch (err) {
      // 3. Catch errors correctly from your API response structure
      const message = err.response?.data?.message || err.message || "Invalid Credentials";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,37,59,0.1)] border border-gray-100 overflow-hidden">
      <div className="p-8 md:p-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0F253B] mb-1 text-center lg:text-left">Login</h2>
          <p className="text-sm text-gray-400 font-medium text-center lg:text-left">Enter your credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium"
              placeholder="admin@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "SIGN IN"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 font-medium">
                Dont have an account?{" "}
                <button
                    type="button"
                    onClick={onSwitch}
                    className="text-[#F47C3C] font-bold hover:underline transition-all"
                >
                    Sign Up
                </button>
            </p>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-300 uppercase tracking-widest font-semibold">
          Secure Portal v1
        </p>
      </div>
    </div>
  );
}