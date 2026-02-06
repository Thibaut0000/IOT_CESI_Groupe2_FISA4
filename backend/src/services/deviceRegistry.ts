import { config } from "../config.js";

export type DeviceStatus = "ONLINE" | "OFFLINE";

export type DeviceInfo = {
  deviceId: string;
  lastSeen: number;
  status: DeviceStatus;
  latestNoiseDb?: number;
};

const devices = new Map<string, DeviceInfo>();

export const updateDevice = (deviceId: string, noiseDb?: number) => {
  const now = Date.now();
  const existing = devices.get(deviceId);
  devices.set(deviceId, {
    deviceId,
    lastSeen: now,
    status: "ONLINE",
    latestNoiseDb: noiseDb ?? existing?.latestNoiseDb
  });
};

export const markOffline = (deviceId: string) => {
  const existing = devices.get(deviceId);
  if (!existing) return;
  devices.set(deviceId, { ...existing, status: "OFFLINE" });
};

export const listDevices = () => Array.from(devices.values());

export const getDevice = (deviceId: string) => devices.get(deviceId) ?? null;

export const checkOffline = () => {
  const now = Date.now();
  const thresholdMs = config.offlineThresholdSeconds * 1000;
  devices.forEach((device) => {
    if (now - device.lastSeen > thresholdMs && device.status !== "OFFLINE") {
      devices.set(device.deviceId, { ...device, status: "OFFLINE" });
    }
  });
};