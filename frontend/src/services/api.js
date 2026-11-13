import axios from 'axios';

/**
 * Resolves the backend base URL dynamically:
 * - If VITE_API_URL is configured:
 *     - If it points to localhost/127.0.0.1, but the user is accessing via a LAN IP or hostname,
 *       it intelligently replaces localhost with the current browser hostname so it works
 *       seamlessly from any other laptop on the LAN without manual edits!
 *     - If it points to an explicit remote IP/domain, it uses it directly.
 * - If VITE_API_URL is omitted or empty:
 *     - In browser: uses `${protocol}//${hostname}:5000/api`
 *     - Fallback / SSR: uses `http://localhost:5000/api`
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const isBrowser = typeof window !== 'undefined' && window.location && window.location.hostname;

  if (envUrl) {
    if (isBrowser) {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(envUrl, window.location.origin);
          if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            parsed.hostname = hostname;
            return parsed.toString().replace(/\/$/, '');
          }
        } catch {
          // If envUrl is relative, e.g. "/api"
          return envUrl;
        }
      }
    }
    return envUrl;
  }

  if (isBrowser) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

/**
 * Resolves the backend server root URL (without trailing /api),
 * used for serving static assets such as uploaded files (/uploads/...).
 */
export const getBackendBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  try {
    const parsed = new URL(apiUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return apiUrl.replace(/\/api\/?$/, '');
  }
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('brandguard-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('brandguard-token', token);
  } else {
    localStorage.removeItem('brandguard-token');
  }
};

export default api;
