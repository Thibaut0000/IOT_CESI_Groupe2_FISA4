import { config } from "../config.js";

export type DeviceStatus = "ONLINE" | "OFFLINE";

export type DeviceInfo = {
  deviceId: string;
  zone: string;
  lastSeen: number;
  status: DeviceStatus;
  /** Status reported by the sensor itself via MQTT status topic */
  sensorOnline: boolean | null;
  latestNoiseDb?: number;
  /** Whether the sensor is enabled (active) or disabled */
  enabled: boolean;
  /** Whether energy saving mode is active */
  ecoMode: boolean;
};

const devices = new Map<string, DeviceInfo>();

/**
 * Called on every noise (db) message.
 * Marks device ONLINE and updates noise + lastSeen.
 */
export const updateDevice = (deviceId: string, zone: string, noiseDb?: number) => {
  const now = Date.now();
  const existing = devices.get(deviceId);
  devices.set(deviceId, {
    deviceId,
    zone,
    lastSeen: now,
    status: "ONLINE",
    sensorOnline: existing?.sensorOnline ?? null,
    latestNoiseDb: noiseDb ?? existing?.latestNoiseDb,
    enabled: existing?.enabled ?? true,
    ecoMode: existing?.ecoMode ?? false
  });
};

/**
 * Called when we receive a status message from the Arduino.
 * Provides an authoritative online/offline from the sensor hardware.
 */
export const setDeviceStatus = (deviceId: string, zone: string, status: DeviceStatus) => {
  const now = Date.now();
  const existing = devices.get(deviceId);
  devices.set(deviceId, {
    deviceId,
    zone,
    lastSeen: now,
    status,
    sensorOnline: status === "ONLINE",
    latestNoiseDb: existing?.latestNoiseDb,
    enabled: existing?.enabled ?? true,
    ecoMode: existing?.ecoMode ?? false
  });
};

/**
 * Set the enabled state of a device (activate / deactivate sensor).
 */
export const setDeviceEnabled = (deviceId: string, enabled: boolean) => {
  const existing = devices.get(deviceId);
  if (!existing) return;
  devices.set(deviceId, { ...existing, enabled });
};

/**
 * Set the eco-mode state of a device (energy saving mode).
 */
export const setDeviceEcoMode = (deviceId: string, ecoMode: boolean) => {
  const existing = devices.get(deviceId);
  if (!existing) return;
  devices.set(deviceId, { ...existing, ecoMode });
};

export const markOffline = (deviceId: string) => {
  const existing = devices.get(deviceId);
  if (!existing) return;
  devices.set(deviceId, { ...existing, status: "OFFLINE", sensorOnline: false });
};

export const listDevices = () => Array.from(devices.values());

export const getDevice = (deviceId: string) => devices.get(deviceId) ?? null;

/**
 * Dashboard-side heartbeat check: if no data received for a while, mark OFFLINE.
 * This complements the Arduino-side status topic.
 */
export const checkOffline = () => {
  const now = Date.now();
  const thresholdMs = config.offlineThresholdSeconds * 1000;
  devices.forEach((device) => {
    if (now - device.lastSeen > thresholdMs && device.status !== "OFFLINE") {
      devices.set(device.deviceId, { ...device, status: "OFFLINE", sensorOnline: false });
    }
  });
};