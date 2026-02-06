import type { Stats } from "../types";

type Props = {
  noiseDb: number | null | undefined;
  deviceId: string | null;
  zone?: string | null;
  stats?: Stats | null;
};

function getNoiseLevel(db: number | null | undefined): { label: string; color: string; bg: string; darkBg: string } {
  if (db == null) return { label: "N/A", color: "text-gray-500", bg: "bg-gray-100", darkBg: "dark:bg-gray-800" };
  if (db < 50) return { label: "Calme", color: "text-green-600", bg: "bg-green-100", darkBg: "dark:bg-green-900/40" };
  if (db < 70) return { label: "Modéré", color: "text-yellow-600", bg: "bg-yellow-100", darkBg: "dark:bg-yellow-900/40" };
  if (db < 85) return { label: "Élevé", color: "text-orange-600", bg: "bg-orange-100", darkBg: "dark:bg-orange-900/40" };
  return { label: "Danger", color: "text-red-600", bg: "bg-red-100", darkBg: "dark:bg-red-900/40" };
}

export default function NoiseCard({ noiseDb, deviceId, zone, stats }: Props) {
  const level = getNoiseLevel(noiseDb);

  return (
    <div className={`rounded-xl shadow-lg p-8 ${level.bg} ${level.darkBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Capteur {deviceId ?? "-"}{zone ? ` — 📍 ${zone}` : ""}
          </p>
          <p className={`text-6xl font-bold ${level.color}`}>
            {noiseDb != null ? noiseDb.toFixed(1) : "--"} <span className="text-2xl">dB</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`px-4 py-2 rounded-full text-lg font-semibold ${level.color} ${level.bg} ${level.darkBg}`}>
            {level.label}
          </span>
        </div>
      </div>
      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Min</p>
            <p className="text-xl font-bold text-blue-600">{stats.min.toFixed(1)} <span className="text-xs">dB</span></p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Moy</p>
            <p className="text-xl font-bold text-purple-600">{stats.avg.toFixed(1)} <span className="text-xs">dB</span></p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Max</p>
            <p className="text-xl font-bold text-red-600">{stats.max.toFixed(1)} <span className="text-xs">dB</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
