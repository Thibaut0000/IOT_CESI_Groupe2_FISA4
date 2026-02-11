import { create } from "zustand";
import type { Device, NoiseDataPoint, Threshold, WsEvent } from "../types";

// Persist muted devices in localStorage
const MUTED_KEY = "muted-devices";
const loadMuted = (): Set<string> => {
  try {
    const raw = localStorage.getItem(MUTED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const saveMuted = (s: Set<string>) => localStorage.setItem(MUTED_KEY, JSON.stringify([...s]));

interface DataState {
  devices: Device[];
  currentNoise: Record<string, number>;
  thresholds: Threshold[];
  alerts: Array<{ deviceId: string; noiseDb: number; thresholdDb: number; ts: number }>;
  // Live chart data from WebSocket (last 300 points per device)
  liveHistory: Record<string, NoiseDataPoint[]>;
  /** Devices whose notifications are muted */
  mutedDevices: Set<string>;
  setDevices: (devices: Device[]) => void;
  updateDevice: (deviceId: string, data: Partial<Device>) => void;
  setNoise: (deviceId: string, noiseDb: number) => void;
  setThresholds: (thresholds: Threshold[]) => void;
  addAlert: (alert: { deviceId: string; noiseDb: number; thresholdDb: number; ts: number }) => void;
  clearAlerts: () => void;
  toggleMute: (deviceId: string) => void;
  handleWsEvent: (event: WsEvent) => void;
}

const MAX_LIVE_POINTS = 300;

export const useDataStore = create<DataState>()((set, get) => ({
  devices: [],
  currentNoise: {},
  thresholds: [],
  alerts: [],
  liveHistory: {},
  mutedDevices: loadMuted(),
  setDevices: (devices) => set({ devices }),
  updateDevice: (deviceId, data) =>
    set((state) => ({
      devices: state.devices.map((d) => (d.deviceId === deviceId ? { ...d, ...data } : d))
    })),
  setNoise: (deviceId, noiseDb) =>
    set((state) => ({ currentNoise: { ...state.currentNoise, [deviceId]: noiseDb } })),
  setThresholds: (thresholds) => set({ thresholds }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts.slice(-49), alert] })),
  clearAlerts: () => set({ alerts: [] }),
  toggleMute: (deviceId) => set((state) => {
    const next = new Set(state.mutedDevices);
    if (next.has(deviceId)) next.delete(deviceId); else next.add(deviceId);
    saveMuted(next);
    return { mutedDevices: next };
  }),
  handleWsEvent: (event) => {
    const state = get();
    switch (event.type) {
      case "noise":
        state.setNoise(event.deviceId, event.noiseDb);
        // Append to live history
        set((s) => {
          const prev = s.liveHistory[event.deviceId] ?? [];
          const point: NoiseDataPoint = {
            _time: new Date(event.ts).toISOString(),
            _value: event.noiseDb
          };
          return {
            liveHistory: {
              ...s.liveHistory,
              [event.deviceId]: [...prev.slice(-(MAX_LIVE_POINTS - 1)), point]
            }
          };
        });
        {
          const existing = state.devices.find((d) => d.deviceId === event.deviceId);
          if (existing) {
            state.updateDevice(event.deviceId, {
              zone: event.zone,
              latestNoiseDb: event.noiseDb,
              status: "ONLINE",
              lastSeen: event.ts
            });
          } else {
            set({
              devices: [
                ...state.devices,
                {
                  deviceId: event.deviceId,
                  zone: event.zone,
                  status: "ONLINE",
                  lastSeen: event.ts,
                  latestNoiseDb: event.noiseDb
                }
              ]
            });
          }
        }
        break;
      case "alert":
        state.addAlert(event);
        break;
      case "device_status":
        {
          const existing = state.devices.find((d) => d.deviceId === event.deviceId);
          if (existing) {
            state.updateDevice(event.deviceId, { zone: event.zone, status: event.status, lastSeen: event.lastSeen, sensorOnline: event.status === "ONLINE" });
          } else {
            set({ devices: [...state.devices, { deviceId: event.deviceId, zone: event.zone, status: event.status, lastSeen: event.lastSeen, sensorOnline: event.status === "ONLINE" }] });
          }
        }
        break;
      case "thresholds":
        state.setThresholds(event.thresholds);
        break;
      case "device_config":
        {
          const existing = state.devices.find((d) => d.deviceId === event.deviceId);
          if (existing) {
            const update: Partial<Device> = {};
            if (event.enabled !== undefined) update.enabled = event.enabled;
            if (event.ecoMode !== undefined) update.ecoMode = event.ecoMode;
            state.updateDevice(event.deviceId, update);
          }
        }
        break;
    }
  }
}));
