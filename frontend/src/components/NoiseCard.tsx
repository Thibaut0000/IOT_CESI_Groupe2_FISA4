type Props = {
  noiseDb: number | null | undefined;
  deviceId: string | null;
};

function getNoiseLevel(db: number | null | undefined): { label: string; color: string; bg: string } {
  if (db == null) return { label: "N/A", color: "text-gray-500", bg: "bg-gray-100" };
  if (db < 50) return { label: "Calme", color: "text-green-600", bg: "bg-green-100" };
  if (db < 70) return { label: "Modéré", color: "text-yellow-600", bg: "bg-yellow-100" };
  if (db < 85) return { label: "Élevé", color: "text-orange-600", bg: "bg-orange-100" };
  return { label: "Danger", color: "text-red-600", bg: "bg-red-100" };
}

export default function NoiseCard({ noiseDb, deviceId }: Props) {
  const level = getNoiseLevel(noiseDb);

  return (
    <div className={`rounded-xl shadow-lg p-8 ${level.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">Capteur {deviceId ?? "-"}</p>
          <p className={`text-6xl font-bold ${level.color}`}>
            {noiseDb != null ? noiseDb.toFixed(1) : "--"} <span className="text-2xl">dB</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`px-4 py-2 rounded-full text-lg font-semibold ${level.color} ${level.bg}`}>
            {level.label}
          </span>
        </div>
      </div>
    </div>
  );
}
