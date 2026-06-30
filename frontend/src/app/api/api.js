import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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

// auto refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry && refreshHandler) {
      original._retry = true;

      const newToken = await refreshHandler();

      original.headers.Authorization = `Bearer ${newToken}`;

      return api(original);
    }

    return Promise.reject(err);
  }
);

export default api;