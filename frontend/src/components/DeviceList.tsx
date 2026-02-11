import { useState } from "react";
import { api } from "../lib/api";
import type { Device } from "../types";

type Props = {
  devices: Device[];
  selected: string | null;
  onSelect: (deviceId: string) => void;
  currentNoise: Record<string, number>;
  mutedDevices: Set<string>;
  onToggleMute: (deviceId: string) => void;
};

export default function DeviceList({ devices, selected, onSelect, currentNoise, mutedDevices, onToggleMute }: Props) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleToggleEnabled = async (e: React.MouseEvent, deviceId: string, currentEnabled: boolean) => {
    e.stopPropagation();
    setLoading((prev) => ({ ...prev, [deviceId]: true }));
    try {
      await api.setDeviceEnabled(deviceId, !currentEnabled);
    } catch (err) {
      console.error("Failed to toggle device enabled state", err);
    } finally {
      setLoading((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const handleToggleEco = async (e: React.MouseEvent, deviceId: string, currentEco: boolean) => {
    e.stopPropagation();
    setLoading((prev) => ({ ...prev, [`${deviceId}_eco`]: true }));
    try {
      await api.setDeviceEcoMode(deviceId, !currentEco);
    } catch (err) {
      console.error("Failed to toggle eco mode", err);
    } finally {
      setLoading((prev) => ({ ...prev, [`${deviceId}_eco`]: false }));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Capteurs</h2>
      <div className="space-y-2">
        {devices.length === 0 && <p className="text-gray-500 dark:text-gray-400">Aucun capteur détecté</p>}
        {devices.map((d) => {
          const isEnabled = d.enabled !== false;
          const isEco = d.ecoMode === true;
          return (
            <button
              key={d.deviceId}
              onClick={() => onSelect(d.deviceId)}
              className={`w-full p-4 rounded-lg text-left transition ${
                selected === d.deviceId
                  ? "bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500"
                  : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
              } ${!isEnabled ? "opacity-60" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{d.deviceId}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">📍 {d.zone}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {currentNoise[d.deviceId]?.toFixed(1) ?? d.latestNoiseDb?.toFixed(1) ?? "--"} dB
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleMute(d.deviceId); }}
                      className={`p-1 rounded-md text-sm transition ${
                        mutedDevices.has(d.deviceId)
                          ? "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          : "text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
                      }`}
                      title={mutedDevices.has(d.deviceId) ? "Activer les notifications" : "Désactiver les notifications"}
                    >
                      {mutedDevices.has(d.deviceId) ? "🔕" : "🔔"}
                    </button>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        d.status === "ONLINE" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  {d.sensorOnline != null && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500" title="Statut rapporté par le capteur">
                      capteur: {d.sensorOnline ? "✅" : "❌"}
                    </span>
                  )}
                  {/* Contrôles sobriété énergétique */}
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={(e) => handleToggleEnabled(e, d.deviceId, isEnabled)}
                      disabled={loading[d.deviceId]}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        isEnabled
                          ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60"
                          : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60"
                      } ${loading[d.deviceId] ? "opacity-50 cursor-wait" : ""}`}
                      title={isEnabled ? "Désactiver le capteur" : "Activer le capteur"}
                    >
                      {isEnabled ? "⚡ Actif" : "💤 Inactif"}
                    </button>
                    <button
                      onClick={(e) => handleToggleEco(e, d.deviceId, isEco)}
                      disabled={loading[`${d.deviceId}_eco`]}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        isEco
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                      } ${loading[`${d.deviceId}_eco`] ? "opacity-50 cursor-wait" : ""}`}
                      title={isEco ? "Désactiver le mode éco" : "Activer le mode éco"}
                    >
                      {isEco ? "🌿 Éco" : "🌿 Éco off"}
                    </button>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
