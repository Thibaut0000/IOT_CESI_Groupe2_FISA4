import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { NoiseDataPoint } from "../types";

type Props = {
  data: NoiseDataPoint[];
};

export default function NoiseChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: new Date(d._time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    value: d._value
  }));

  if (chartData.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500">Pas de données</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 120]} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)} dB`, "Bruit"]}
            labelFormatter={(label) => `Heure: ${label}`}
          />
          <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" label="Modéré" />
          <ReferenceLine y={85} stroke="#dc2626" strokeDasharray="3 3" label="Danger" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
