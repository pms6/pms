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

  // VERIFY OTP — activates the account, creates the profile, and logs the
  // user in (sets the cookie). We hydrate afterwards.
  const verifyOtp = async ({ email, otp, targetRole }) => {
    await api.post("/auth/verify-otp", { email, otp, targetRole });
    return loadMe();
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
        verifyOtp,
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
