import { useAuthStore } from "../stores/authStore";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  },
  getDevices: async () => {
    const res = await fetch(`${API_URL}/devices`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },
  getMetricsLatest: async (deviceId: string) => {
    const res = await fetch(`${API_URL}/metrics/latest?deviceId=${deviceId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch latest metrics");
    return res.json();
  },
  getMetricsHistory: async (deviceId: string, minutes = 30) => {
    const res = await fetch(`${API_URL}/metrics/history?deviceId=${deviceId}&minutes=${minutes}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
  },
  getMetricsStats: async (deviceId: string, minutes = 60) => {
    const res = await fetch(`${API_URL}/metrics/stats?deviceId=${deviceId}&minutes=${minutes}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },
  getThresholds: async () => {
    const res = await fetch(`${API_URL}/admin/thresholds`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch thresholds");
    return res.json();
  },
  setThreshold: async (deviceId: string | null, thresholdDb: number) => {
    const res = await fetch(`${API_URL}/admin/thresholds`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ deviceId, thresholdDb })
    });
    if (!res.ok) throw new Error("Failed to set threshold");
    return res.json();
  },
  getAudit: async () => {
    const res = await fetch(`${API_URL}/admin/audit`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  }
};
