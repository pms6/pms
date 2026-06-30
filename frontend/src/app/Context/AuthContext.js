"use client"
import { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken, setRefreshHandler } from "../api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // LOGIN
  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });

    const { user, tokens } = res.data.data;

    setUser(user);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);

    return user; // <-- return logged-in user
  };

  // REGISTER
  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);

    const { user, tokens } = res.data.data;

    setUser(user);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
  };

  // LOGOUT
  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  // REFRESH LOGIC (matches backend)
  const refresh = async () => {
    if (!refreshToken) throw new Error("No refresh token");

    const res = await api.post("/auth/refresh", {
      refreshToken,
    });

    const { tokens } = res.data.data;

    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken || refreshToken);

    return tokens.accessToken;
  };

  // LOAD USER
  const loadMe = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // setup refresh handler for interceptor
  useEffect(() => {
    setRefreshHandler(refresh);
    loadMe();
  }, [refreshToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);