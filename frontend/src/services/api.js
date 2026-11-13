import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://YOUR-BACKEND-URL.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("brandguard-token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("brandguard-token", token);
  } else {
    localStorage.removeItem("brandguard-token");
  }
};

export default api;