import type { Device } from "../types";

type Props = {
  devices: Device[];
  selected: string | null;
  onSelect: (deviceId: string) => void;
  currentNoise: Record<string, number>;
};

export default function DeviceList({ devices, selected, onSelect, currentNoise }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Capteurs</h2>
      <div className="space-y-2">
        {devices.length === 0 && <p className="text-gray-500 dark:text-gray-400">Aucun capteur détecté</p>}
        {devices.map((d) => (
          <button
            key={d.deviceId}
            onClick={() => onSelect(d.deviceId)}
            className={`w-full p-4 rounded-lg text-left transition ${
              selected === d.deviceId
                ? "bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500"
                : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{d.deviceId}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">📍 {d.zone}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {currentNoise[d.deviceId]?.toFixed(1) ?? d.latestNoiseDb?.toFixed(1) ?? "--"} dB
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    d.status === "ONLINE" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400"
                  }`}
                >
                  {d.status}
                </span>
                {d.sensorOnline != null && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500" title="Statut rapporté par le capteur">
                    capteur: {d.sensorOnline ? "✅" : "❌"}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
