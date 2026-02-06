import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { HealthStatus } from "../types";

export default function StatusIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const fetch = () => api.getHealth().then(setHealth).catch(() => setHealth(null));
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, []);

  const dot = (status: string | undefined) => {
    const ok = status === "connected" || status === "ok";
    return (
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${
          ok ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
        }`}
      />
    );
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        {dot(health?.mqtt)} <span className="text-gray-600 dark:text-gray-400">MQTT</span>
      </span>
      <span className="flex items-center gap-1.5">
        {dot(health?.influx)} <span className="text-gray-600 dark:text-gray-400">InfluxDB</span>
      </span>
    </div>
  );
}
