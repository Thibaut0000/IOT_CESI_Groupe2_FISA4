import type { Device } from "../types";

type Props = {
  devices: Device[];
  selected: string | null;
  onSelect: (deviceId: string) => void;
  currentNoise: Record<string, number>;
};

export default function DeviceList({ devices, selected, onSelect, currentNoise }: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Capteurs</h2>
      <div className="space-y-2">
        {devices.length === 0 && <p className="text-gray-500">Aucun capteur détecté</p>}
        {devices.map((d) => (
          <button
            key={d.deviceId}
            onClick={() => onSelect(d.deviceId)}
            className={`w-full p-4 rounded-lg text-left transition ${
              selected === d.deviceId ? "bg-blue-100 border-2 border-blue-500" : "bg-gray-50 hover:bg-gray-100"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">{d.deviceId}</p>
                <p className="text-sm text-gray-500">
                  {currentNoise[d.deviceId]?.toFixed(1) ?? d.latestNoiseDb?.toFixed(1) ?? "--"} dB
                </p>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  d.status === "ONLINE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {d.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
