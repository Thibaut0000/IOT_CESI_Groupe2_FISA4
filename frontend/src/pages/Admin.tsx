import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import type { AuditLog, Threshold } from "../types";

export default function Admin() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const devices = useDataStore((s) => s.devices);
  const setDevices = useDataStore((s) => s.setDevices);
  const setThresholds = useDataStore((s) => s.setThresholds);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [globalThreshold, setGlobalThreshold] = useState(85);
  const [deviceThresholds, setDeviceThresholds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, { min: number; max: number; avg: number } | null>>({});

  useEffect(() => {
    api.getDevices().then(setDevices).catch(console.error);
    api.getThresholds().then((t: Threshold[]) => {
      setThresholds(t);
      const global = t.find((x) => x.deviceId === null);
      if (global) setGlobalThreshold(global.thresholdDb);
      const perDevice: Record<string, number> = {};
      t.filter((x) => x.deviceId !== null).forEach((x) => {
        perDevice[x.deviceId!] = x.thresholdDb;
      });
      setDeviceThresholds(perDevice);
    });
    api.getAudit().then(setAuditLogs).catch(console.error);
  }, [setDevices, setThresholds]);

  useEffect(() => {
    devices.forEach((d) => {
      api.getMetricsStats(d.deviceId, 60).then((s) => {
        setStats((prev) => ({ ...prev, [d.deviceId]: s }));
      });
    });
  }, [devices]);

  const handleSaveGlobal = async () => {
    setSaving(true);
    await api.setThreshold(null, globalThreshold);
    setSaving(false);
  };

  const handleSaveDevice = async (deviceId: string) => {
    setSaving(true);
    await api.setThreshold(deviceId, deviceThresholds[deviceId] ?? globalThreshold);
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Administration</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Global Threshold */}
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Seuil global (dB)</h2>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={globalThreshold}
              onChange={(e) => setGlobalThreshold(Number(e.target.value))}
              className="border rounded-lg px-4 py-2 w-32"
            />
            <button
              onClick={handleSaveGlobal}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </section>

        {/* Device Table */}
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Capteurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Device</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">Last Seen</th>
                  <th className="text-left py-2 px-4">Min (1h)</th>
                  <th className="text-left py-2 px-4">Avg (1h)</th>
                  <th className="text-left py-2 px-4">Max (1h)</th>
                  <th className="text-left py-2 px-4">Seuil (dB)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.deviceId} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium">{d.deviceId}</td>
                    <td className="py-2 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          d.status === "ONLINE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-gray-500">{new Date(d.lastSeen).toLocaleTimeString()}</td>
                    <td className="py-2 px-4">{stats[d.deviceId]?.min?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4">{stats[d.deviceId]?.avg?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4">{stats[d.deviceId]?.max?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        value={deviceThresholds[d.deviceId] ?? globalThreshold}
                        onChange={(e) =>
                          setDeviceThresholds((prev) => ({ ...prev, [d.deviceId]: Number(e.target.value) }))
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() => handleSaveDevice(d.deviceId)}
                        disabled={saving}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Sauver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Offline Help */}
        <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Capteur OFFLINE ?</h2>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            <li>Vérifier l'alimentation du capteur</li>
            <li>Vérifier la connexion au réseau (WiFi/Ethernet)</li>
            <li>Vérifier que le broker MQTT est accessible (ping 172.20.10.2)</li>
            <li>Redémarrer le capteur si nécessaire</li>
          </ul>
        </section>

        {/* Audit Logs */}
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Logs d'audit</h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-left py-2 px-4">Action</th>
                  <th className="text-left py-2 px-4">Acteur</th>
                  <th className="text-left py-2 px-4">Détails</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2 px-4 font-medium">{log.action}</td>
                    <td className="py-2 px-4">{log.actor}</td>
                    <td className="py-2 px-4 text-gray-500">{log.data ? JSON.stringify(log.data) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
