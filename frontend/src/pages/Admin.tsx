import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useDataStore } from "../stores/dataStore";
import DarkModeToggle from "../components/DarkModeToggle";
import StatusIndicator from "../components/StatusIndicator";
import type { AuditLog, Threshold, User } from "../types";

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

  // User management
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [userMsg, setUserMsg] = useState("");

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
    api.getUsers().then(setUsers).catch(console.error);
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg("");
    try {
      await api.createUser(newEmail, newPassword, newRole);
      setUserMsg("✅ Utilisateur créé");
      setNewEmail("");
      setNewPassword("");
      api.getUsers().then(setUsers);
    } catch {
      setUserMsg("❌ Erreur lors de la création");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">⚙️ Administration</h1>
            <StatusIndicator />
          </div>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* User Management */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">👥 Gestion des utilisateurs</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create user form */}
            <form onSubmit={handleCreateUser} className="space-y-3">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Créer un utilisateur</h3>
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full border dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              <input
                type="password"
                placeholder="Mot de passe (min 6 car.)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-100"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
                className="w-full border dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Créer
              </button>
              {userMsg && <p className="text-sm mt-1">{userMsg}</p>}
            </form>

            {/* User list */}
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Utilisateurs existants</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {users.map((u) => (
                  <div key={u.email} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{u.email}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun utilisateur</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Global Threshold */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">🔔 Seuil global (dB)</h2>
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={globalThreshold}
              onChange={(e) => setGlobalThreshold(Number(e.target.value))}
              className="border dark:border-gray-600 rounded-lg px-4 py-2 w-32 bg-white dark:bg-gray-700 dark:text-gray-100"
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
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">📡 Capteurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Device</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Zone</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Last Seen</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Min (1h)</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Avg (1h)</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Max (1h)</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Seuil (dB)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.deviceId} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-4 font-medium text-gray-800 dark:text-gray-100">{d.deviceId}</td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-300">{d.zone || "-"}</td>
                    <td className="py-2 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          d.status === "ONLINE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{new Date(d.lastSeen).toLocaleTimeString()}</td>
                    <td className="py-2 px-4 text-gray-800 dark:text-gray-200">{stats[d.deviceId]?.min?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4 text-gray-800 dark:text-gray-200">{stats[d.deviceId]?.avg?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4 text-gray-800 dark:text-gray-200">{stats[d.deviceId]?.max?.toFixed(1) ?? "-"}</td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        value={deviceThresholds[d.deviceId] ?? globalThreshold}
                        onChange={(e) =>
                          setDeviceThresholds((prev) => ({ ...prev, [d.deviceId]: Number(e.target.value) }))
                        }
                        className="border dark:border-gray-600 rounded px-2 py-1 w-20 bg-white dark:bg-gray-700 dark:text-gray-100"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() => handleSaveDevice(d.deviceId)}
                        disabled={saving}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
        <section className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">⚠️ Capteur OFFLINE ?</h2>
          <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-500 space-y-1">
            <li>Vérifier l'alimentation du capteur</li>
            <li>Vérifier la connexion au réseau (WiFi/Ethernet)</li>
            <li>Vérifier que le broker MQTT est accessible (ping 172.20.10.2)</li>
            <li>Redémarrer le capteur si nécessaire</li>
          </ul>
        </section>

        {/* Audit Logs */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">📋 Logs d'audit</h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800">
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Action</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Acteur</th>
                  <th className="text-left py-2 px-4 text-gray-700 dark:text-gray-300">Détails</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={`${log.created_at}-${i}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2 px-4 font-medium text-gray-800 dark:text-gray-100">{log.action}</td>
                    <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{log.actor}</td>
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{log.data ? JSON.stringify(log.data) : "-"}</td>
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
