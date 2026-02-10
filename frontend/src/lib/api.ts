import { useAuthStore } from "../stores/authStore";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

/** Handle 401 responses by logging out and redirecting to login */
const handleUnauthorized = (res: Response) => {
  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Session expired – please log in again");
  }
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
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },
  getMetricsLatest: async (deviceId: string) => {
    const res = await fetch(`${API_URL}/metrics/latest?deviceId=${deviceId}`, { headers: getHeaders() });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch latest metrics");
    return res.json();
  },
  getMetricsHistory: async (deviceId: string, minutes = 30) => {
    const res = await fetch(`${API_URL}/metrics/history?deviceId=${deviceId}&minutes=${minutes}`, {
      headers: getHeaders()
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
  },
  getMetricsStats: async (deviceId: string, minutes = 60) => {
    const res = await fetch(`${API_URL}/metrics/stats?deviceId=${deviceId}&minutes=${minutes}`, {
      headers: getHeaders()
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },
  getThresholds: async () => {
    const res = await fetch(`${API_URL}/admin/thresholds`, { headers: getHeaders() });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch thresholds");
    return res.json();
  },
  setThreshold: async (deviceId: string | null, thresholdDb: number) => {
    const res = await fetch(`${API_URL}/admin/thresholds`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ deviceId, thresholdDb })
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to set threshold");
    return res.json();
  },
  getAudit: async () => {
    const res = await fetch(`${API_URL}/admin/audit`, { headers: getHeaders() });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  },

  // User management (admin)
  getUsers: async () => {
    const res = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },
  createUser: async (email: string, password: string, role: string) => {
    const res = await fetch(`${API_URL}/admin/users`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email, password, role })
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to create user");
    return res.json();
  },

  // Health status
  getHealth: async () => {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error("Failed to fetch health");
    return res.json();
  },

  // CSV export
  downloadCSV: async (deviceId: string, minutes: number) => {
    const token = useAuthStore.getState().token;
    const res = await fetch(
      `${API_URL}/admin/export/csv?deviceId=${deviceId}&minutes=${minutes}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    handleUnauthorized(res);
    if (!res.ok) throw new Error("Failed to export CSV");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noise_${deviceId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
