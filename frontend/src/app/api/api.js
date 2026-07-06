import axios from "axios";

// The backend authenticates with an httpOnly `token` cookie (set by
// sendTokenResponse on the server). `withCredentials` makes the browser send
// that cookie with every request and store the one returned on login — so
// there is no access token to juggle in JS.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

export default api;
