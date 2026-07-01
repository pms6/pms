"use client";
import { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken, setRefreshHandler } from "../api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // LOGIN — access token kept in memory; refresh token set as httpOnly cookie
  // by the server, so we never touch it from JS.
  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { user, tokens } = res.data.data;
    setUser(user);
    setAccessToken(tokens.accessToken);
    return user;
  };

  // REGISTER
  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    const { user, tokens } = res.data.data;
    setUser(user);
    setAccessToken(tokens.accessToken);
    return user;
  };

  // LOGOUT — clears the refresh cookie server-side, then the in-memory state.
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore network/log-out errors; clear local state regardless
    }
    setUser(null);
    setAccessToken(null);
  };

  // REFRESH — the cookie rides along automatically (withCredentials), so no
  // token is needed in the body. Returns the new access token for the
  // axios interceptor to retry the original request.
  const refresh = async () => {
    const res = await api.post("/auth/refresh");
    const { tokens } = res.data.data;
    setAccessToken(tokens.accessToken);
    return tokens.accessToken;
  };

  // LOAD CURRENT USER (assumes a valid access token is in memory).
  const loadMe = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data.data);
  };

  // Make refresh available to the response interceptor once.
  useEffect(() => {
    setRefreshHandler(refresh);
  }, []);

  // Boot: try to restore the session from the refresh cookie. If there is no
  // valid cookie, /auth/refresh 401s and we simply stay logged out.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refresh();
        if (active) await loadMe();
      } catch {
        if (active) setUser(null);
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
        login,
        register,
        logout,
        refresh,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
