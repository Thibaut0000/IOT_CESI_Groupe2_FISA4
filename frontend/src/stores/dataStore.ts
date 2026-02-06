import { create } from "zustand";
import type { Device, Threshold, WsEvent } from "../types";

interface DataState {
  devices: Device[];
  currentNoise: Record<string, number>;
  thresholds: Threshold[];
  alerts: Array<{ deviceId: string; noiseDb: number; thresholdDb: number; ts: number }>;
  setDevices: (devices: Device[]) => void;
  updateDevice: (deviceId: string, data: Partial<Device>) => void;
  setNoise: (deviceId: string, noiseDb: number) => void;
  setThresholds: (thresholds: Threshold[]) => void;
  addAlert: (alert: { deviceId: string; noiseDb: number; thresholdDb: number; ts: number }) => void;
  clearAlerts: () => void;
  handleWsEvent: (event: WsEvent) => void;
}

export const useDataStore = create<DataState>()((set, get) => ({
  devices: [],
  currentNoise: {},
  thresholds: [],
  alerts: [],
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
  handleWsEvent: (event) => {
    const state = get();
    switch (event.type) {
      case "noise":
        state.setNoise(event.deviceId, event.noiseDb);
        {
          const existing = state.devices.find((d) => d.deviceId === event.deviceId);
          if (existing) {
            state.updateDevice(event.deviceId, {
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
            state.updateDevice(event.deviceId, { status: event.status, lastSeen: event.lastSeen });
          } else {
            set({ devices: [...state.devices, { deviceId: event.deviceId, status: event.status, lastSeen: event.lastSeen }] });
          }
        }
        break;
      case "thresholds":
        state.setThresholds(event.thresholds);
        break;
    }
  }
}));
