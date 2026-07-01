import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // send/receive the httpOnly refresh cookie
});

let accessToken = null;
let refreshHandler = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const setRefreshHandler = (fn) => {
  refreshHandler = fn;
};

// attach JWT
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Endpoints that must never trigger the auto-refresh retry (avoids loops:
// a failing /auth/refresh would otherwise call the refresh handler forever).
const NO_REFRESH = ["/auth/refresh", "/auth/login", "/auth/logout"];

// auto refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthEndpoint = NO_REFRESH.some((p) => (original?.url || "").includes(p));

    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint && refreshHandler) {
      original._retry = true;
      try {
        const newToken = await refreshHandler();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
