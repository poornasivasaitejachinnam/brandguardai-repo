
import axios from 'axios';

/**
 * ============================================================
 * 1. API BASE URL CONFIGURATION
 * ============================================================
 *
 * Resolves the backend API URL dynamically.
 *
 * Priority:
 * 1. Uses VITE_API_URL if configured.
 * 2. Replaces localhost with the current browser hostname
 *    when accessing from another LAN device.
 * 3. Uses current browser hostname with port 5000.
 * 4. Falls back to localhost during SSR.
 */

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  const isBrowser =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname;

  // Case 1: Environment variable is configured
  if (envUrl) {
    if (isBrowser) {
      const hostname = window.location.hostname;

      // Replace localhost with LAN hostname/IP
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(envUrl, window.location.origin);

          if (
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1'
          ) {
            parsed.hostname = hostname;

            return parsed.toString().replace(/\/$/, '');
          }
        } catch {
          // Supports relative URLs such as "/api"
          return envUrl;
        }
      }
    }

    return envUrl;
  }

  // Case 2: Browser fallback
  if (isBrowser) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname;

    return `${protocol}//${hostname}:5000/api`;
  }

  // Case 3: SSR fallback
  return 'http://localhost:5000/api';
};


/**
 * ============================================================
 * 2. BACKEND BASE URL
 * ============================================================
 *
 * Resolves the backend root URL without the /api suffix.
 *
 * Used for static assets such as:
 * /uploads/profile.png
 */

export const getBackendBaseUrl = () => {
  const apiUrl = getApiBaseUrl();

  try {
    const parsed = new URL(
      apiUrl,
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:5000'
    );

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return apiUrl.replace(/\/api\/?$/, '');
  }
};


/**
 * ============================================================
 * 3. AXIOS INSTANCE CONFIGURATION
 * ============================================================
 *
 * Creates a reusable Axios instance.
 *
 * Configuration:
 * - Dynamic base URL
 * - Request timeout: 15 seconds
 */

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
});


/**
 * ============================================================
 * 4. REQUEST INTERCEPTOR
 * ============================================================
 *
 * Automatically attaches the authentication token
 * to every outgoing API request.
 *
 * Authorization format:
 * Bearer <token>
 */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('brandguard-token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


/**
 * ============================================================
 * 5. AUTHENTICATION TOKEN MANAGEMENT
 * ============================================================
 *
 * Stores or removes the authentication token
 * from browser localStorage.
 */

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('brandguard-token', token);
  } else {
    localStorage.removeItem('brandguard-token');
  }
};


/**
 * ============================================================
 * 6. EXPORT AXIOS INSTANCE
 * ============================================================
 *
 * Import this API instance wherever backend
 * communication is required.
 */

export default api;
