import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useDataStore } from "../stores/dataStore";
import { useAuthStore } from "../stores/authStore";
import NoiseCard from "../components/NoiseCard";
import DeviceList from "../components/DeviceList";
import NoiseChart from "../components/NoiseChart";
import StatusIndicator from "../components/StatusIndicator";
import DarkModeToggle from "../components/DarkModeToggle";
import type { NoiseDataPoint, Stats } from "../types";

const HISTORY_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "30 min", value: 30 },
  { label: "1 h", value: 60 },
  { label: "6 h", value: 360 },
  { label: "24 h", value: 1440 },
  { label: "7 j", value: 10080 }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const devices = useDataStore((s) => s.devices);
  const currentNoise = useDataStore((s) => s.currentNoise);
  const liveHistory = useDataStore((s) => s.liveHistory);
  const mutedDevices = useDataStore((s) => s.mutedDevices);
  const toggleMute = useDataStore((s) => s.toggleMute);
  const setDevices = useDataStore((s) => s.setDevices);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [history, setHistory] = useState<NoiseDataPoint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [historyMinutes, setHistoryMinutes] = useState(30);
  const [chartMode, setChartMode] = useState<"live" | "history">("live");

  useEffect(() => {
    api.getDevices().then(setDevices).catch(console.error);
  }, [setDevices]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].deviceId);
    }
  }, [devices, selectedDevice]);

  // Fetch history + stats when device or range changes
  useEffect(() => {
    if (!selectedDevice) return;
    const fetchData = () => {
      api.getMetricsHistory(selectedDevice, historyMinutes)
        .then(setHistory)
        .catch((err) => {
          if (err.message !== "Session expired – please log in again") console.error("History fetch error:", err);
        });
      api.getMetricsStats(selectedDevice, historyMinutes)
        .then(setStats)
        .catch((err) => {
          if (err.message !== "Session expired – please log in again") console.error("Stats fetch error:", err);
        });
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [selectedDevice, historyMinutes]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleExportCSV = async () => {
    if (!selectedDevice) return;
    try {
      await api.downloadCSV(selectedDevice, historyMinutes);
    } catch (e) {
      console.error("CSV export failed", e);
    }
  };

  const currentDb = selectedDevice
    ? currentNoise[selectedDevice] ?? devices.find((d) => d.deviceId === selectedDevice)?.latestNoiseDb
    : null;

  // Choose data source for chart
  const chartData = chartMode === "live" && selectedDevice
    ? liveHistory[selectedDevice] ?? []
    : history;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🔊 Dashboard Bruit</h1>
            <StatusIndicator />
          </div>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            {isAdmin() && (
              <button
                onClick={() => navigate("/admin")}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Admin
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Noise card with stats */}
            <NoiseCard noiseDb={currentDb} deviceId={selectedDevice} stats={stats} zone={devices.find((d) => d.deviceId === selectedDevice)?.zone} />

            {/* Chart controls */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {chartMode === "live" ? "📡 Temps réel" : `📊 Historique (${HISTORY_OPTIONS.find(o => o.value === historyMinutes)?.label})`}
                </h2>
                <div className="flex items-center gap-2">
                  {/* Live / History toggle */}
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setChartMode("live")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                        chartMode === "live"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-800"
                      }`}
                    >
                      Live
                    </button>
                    <button
                      onClick={() => setChartMode("history")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                        chartMode === "history"
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 dark:text-gray-300 hover:text-gray-800"
                      }`}
                    >
                      Historique
                    </button>
                  </div>

                  {/* History range selector */}
                  {chartMode === "history" && (
                    <select
                      value={historyMinutes}
                      onChange={(e) => setHistoryMinutes(Number(e.target.value))}
                      className="text-sm border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    >
                      {HISTORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}

                  {/* CSV export */}
                  {isAdmin() && (
                    <button
                      onClick={handleExportCSV}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      title="Exporter CSV"
                    >
                      📥 CSV
                    </button>
                  )}
                </div>
              </div>
              <NoiseChart data={chartData} />
            </div>
          </div>
          <div>
            <DeviceList
              devices={devices}
              selected={selectedDevice}
              onSelect={setSelectedDevice}
              currentNoise={currentNoise}
              mutedDevices={mutedDevices}
              onToggleMute={toggleMute}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
