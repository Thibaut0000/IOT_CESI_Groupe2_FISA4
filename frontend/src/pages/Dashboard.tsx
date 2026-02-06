import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useDataStore } from "../stores/dataStore";
import { useAuthStore } from "../stores/authStore";
import { useWebSocket } from "../hooks/useWebSocket";
import NoiseCard from "../components/NoiseCard";
import DeviceList from "../components/DeviceList";
import NoiseChart from "../components/NoiseChart";
import type { NoiseDataPoint } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const devices = useDataStore((s) => s.devices);
  const currentNoise = useDataStore((s) => s.currentNoise);
  const setDevices = useDataStore((s) => s.setDevices);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [history, setHistory] = useState<NoiseDataPoint[]>([]);

  // Connect to WebSocket for real-time updates
  useWebSocket();

  useEffect(() => {
    api.getDevices().then(setDevices).catch(console.error);
  }, [setDevices]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].deviceId);
    }
  }, [devices, selectedDevice]);

  useEffect(() => {
    if (!selectedDevice) return;
    api.getMetricsHistory(selectedDevice, 30).then(setHistory).catch(console.error);
    const interval = setInterval(() => {
      api.getMetricsHistory(selectedDevice, 30).then(setHistory).catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedDevice]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentDb = selectedDevice ? currentNoise[selectedDevice] ?? devices.find((d) => d.deviceId === selectedDevice)?.latestNoiseDb : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">🔊 Dashboard Bruit</h1>
          <div className="flex items-center gap-4">
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
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <NoiseCard noiseDb={currentDb} deviceId={selectedDevice} />
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Historique (30 min)</h2>
              <NoiseChart data={history} />
            </div>
          </div>
          <div>
            <DeviceList
              devices={devices}
              selected={selectedDevice}
              onSelect={setSelectedDevice}
              currentNoise={currentNoise}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
