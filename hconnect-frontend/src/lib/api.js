const rawBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const API_BASE_URL = rawBase.replace(/\/$/, "");

export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
