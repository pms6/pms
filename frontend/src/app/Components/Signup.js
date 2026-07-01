"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/Context/AuthContext";

export default function SignUpForm({ onSwitch }) {
  const [accountName, setAccountName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useAuth(); // Extract register from your actual context
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Fire the dedicated register function from your AuthContext.
      // Sign-up creates a NEW account; the chosen role is applied to the first
      // user (the backend defaults to "admin" if none is supplied).
      const user = await register({ accountName, name, email, password, role });

      // 2. Redirect to the dashboard matching the created user's role.
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
      // 3. Properly pull errors from Axios response shape
      const message = err.response?.data?.message || err.message || "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,37,59,0.1)] border border-gray-100 overflow-hidden">
      <div className="p-8 md:p-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0F253B] mb-1 text-center lg:text-left">Create Account</h2>
          <p className="text-sm text-gray-400 font-medium text-center lg:text-left">Register a new user portal account</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-5">
          {/* Name Field */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium"
              placeholder="Account Name"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                Name
            </label>

            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium"
                placeholder="Hamza"
                required
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium"
              placeholder="name@company.com"
              required
            />
          </div>

          {/* Role Selection Field */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium appearance-none bg-no-repeat"
              required
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="finance">Finance</option>
              <option value="tenant">Tenant</option>
            </select>
          </div>

          {/* Password Field */}
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
              "REGISTER USER"
            )}
          </button>
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 font-medium">
                Already have an account?{" "}
                <button
                    type="button"
                    onClick={onSwitch}
                    className="text-[#F47C3C] font-bold hover:underline"
                >
                    Login
                </button>
            </p>
        </div>
        </form>
      </div>
    </div>
  );
}