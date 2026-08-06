"use client";
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

const AuthContext = createContext();

const normalizeUser = (user, profile) => {
  if (!user) return null;
  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] ||
    "";
  return {
    ...user,
    role: (user.role || "").toLowerCase(),
    name,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate the current user + profile from the session cookie.
  const loadMe = async () => {
    const res = await api.get("/auth/me");
    const { user: u, profile: p } = res.data;
    setProfile(p || null);
    const normalized = normalizeUser(u, p);
    setUser(normalized);
    return normalized;
  };

  // LOGIN — server sets the httpOnly cookie; we then hydrate from /auth/me.
  const login = async (email, password) => {
    await api.post("/auth/login", { email, password });
    return loadMe();
  };

  // REGISTER — creates the (unverified) user and emails a 6-digit OTP.
  // targetRole is "Tenant" or "Organization". Returns { success, message }.
  const register = async ({ email, password, targetRole }) => {
    const res = await api.post("/auth/register", { email, password, targetRole });
    return res.data;
  };

  // RESEND OTP — issues a fresh verification code for an existing, still
  // unverified account. Calling /auth/register again would be rejected as a
  // duplicate, which is why this has its own endpoint.
  const resendOtp = async (email) => {
    const res = await api.post("/auth/resend-otp", { email });
    return res.data;
  };

  // VERIFY OTP — activates the account, creates the profile, and logs the
  // user in (sets the cookie). We hydrate afterwards.
  const verifyOtp = async ({ email, otp, targetRole }) => {
    await api.post("/auth/verify-otp", { email, otp, targetRole });
    return loadMe();
  };

  // FORGOT PASSWORD — emails a reset code. The reply is intentionally the same
  // whether or not the address is registered, so don't read anything into it.
  const forgotPassword = async (email) => {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  };

  // VERIFY RESET OTP — checks a reset code without spending it, so the UI can
  // move to the new-password step before the user has typed one.
  const verifyResetOtp = async ({ email, otp }) => {
    const res = await api.post("/auth/verify-reset-otp", { email, otp });
    return res.data;
  };

  // RESET PASSWORD — sets the new password. No session is created; the user
  // signs in afterwards with the credentials they just chose.
  const resetPassword = async ({ email, otp, password }) => {
    const res = await api.post("/auth/reset-password", { email, otp, password });
    return res.data;
  };

  // UPDATE PROFILE — persists the COHO personal-information step.
  const updateProfile = async (payload) => {
    const res = await api.patch("/auth/profile", payload);
    const p = res.data.profile;
    setProfile(p);
    setUser((prev) => (prev ? normalizeUser(prev, p) : prev));
    return p;
  };

  // LOGOUT — clears the cookie server-side, then local state.
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network/logout errors; clear local state regardless
    }
    setUser(null);
    setProfile(null);
  };

  // Boot: restore the session from the cookie. If none, /auth/me 401s and we
  // simply stay logged out.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadMe();
      } catch {
        if (active) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        resendOtp,
        verifyOtp,
        forgotPassword,
        verifyResetOtp,
        resetPassword,
        updateProfile,
        logout,
        refreshMe: loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
