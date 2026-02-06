import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import type { NoiseDataPoint } from "../types";
import { useThemeStore } from "../stores/themeStore";

type Props = {
  data: NoiseDataPoint[];
};

export default function NoiseChart({ data }: Props) {
  const dark = useThemeStore((s) => s.dark);

  const chartData = data.map((d) => ({
    time: new Date(d._time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    value: d._value
  }));

  if (chartData.length === 0) {
    return <div className="h-72 flex items-center justify-center text-gray-500 dark:text-gray-400">Pas de données</div>;
  }

  const textColor = dark ? "#9ca3af" : "#6b7280";

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#374151" : "#e5e7eb"} />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: textColor }} interval="preserveStartEnd" />
          <YAxis domain={[0, 120]} tick={{ fontSize: 11, fill: textColor }} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)} dB`, "Bruit"]}
            labelFormatter={(label) => `Heure: ${label}`}
            contentStyle={{
              backgroundColor: dark ? "#1f2937" : "#fff",
              borderColor: dark ? "#374151" : "#e5e7eb",
              color: dark ? "#f3f4f6" : "#111827",
              borderRadius: "8px"
            }}
          />
          <ReferenceLine y={70} stroke="#eab308" strokeDasharray="3 3" label={{ value: "Modéré", fill: "#eab308", fontSize: 11 }} />
          <ReferenceLine y={85} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "Danger", fill: "#dc2626", fontSize: 11 }} />
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
