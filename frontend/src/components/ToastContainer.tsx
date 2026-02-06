import { useEffect, useState, useCallback } from "react";
import { useDataStore } from "../stores/dataStore";

type Toast = {
  id: number;
  message: string;
  level: "warning" | "danger";
  ts: number;
};

let nextId = 0;

// Simple beep using Web Audio API
function playAlertSound(level: "warning" | "danger") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = level === "danger" ? 880 : 660;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    if (level === "danger") {
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.frequency.value = 880;
        g2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 300);
    }
  } catch {
    // Audio not available
  }
}

export default function ToastContainer() {
  const alerts = useDataStore((s) => s.alerts);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastAlertCount, setLastAlertCount] = useState(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (alerts.length > lastAlertCount) {
      const newAlerts = alerts.slice(lastAlertCount);
      const newToasts: Toast[] = newAlerts.map((a) => {
        const level = a.noiseDb >= 85 ? "danger" as const : "warning" as const;
        playAlertSound(level);
        return {
          id: nextId++,
          message: `⚠️ ${a.deviceId}: ${a.noiseDb.toFixed(1)} dB (seuil: ${a.thresholdDb} dB)`,
          level,
          ts: a.ts
        };
      });
      setToasts((prev) => [...prev, ...newToasts].slice(-5));
    }
    setLastAlertCount(alerts.length);
  }, [alerts, lastAlertCount]);

  // Auto-dismiss after 6s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 p-4 rounded-lg shadow-lg text-white transition-all animate-slide-in ${
            t.level === "danger" ? "bg-red-600" : "bg-orange-500"
          }`}
        >
          <span className="flex-1 text-sm font-medium">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-white/80 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
