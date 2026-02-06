export type Role = "admin" | "user";

export type DeviceStatus = "ONLINE" | "OFFLINE";

export type Device = {
  deviceId: string;
  zone: string;
  lastSeen: number;
  status: DeviceStatus;
  /** Status reported by the sensor hardware (Arduino) via MQTT */
  sensorOnline?: boolean | null;
  latestNoiseDb?: number;
};

export type NoiseDataPoint = {
  _time: string;
  _value: number;
};

export type Stats = {
  min: number;
  max: number;
  avg: number;
  count: number;
};

export type Threshold = {
  deviceId: string | null;
  thresholdDb: number;
};

export type WsEvent =
  | { type: "noise"; deviceId: string; zone: string; noiseDb: number; ts: number }
  | { type: "alert"; deviceId: string; zone: string; noiseDb: number; thresholdDb: number; ts: number }
  | { type: "device_status"; deviceId: string; zone: string; status: DeviceStatus; lastSeen: number }
  | { type: "thresholds"; thresholds: Threshold[] };

export type AuditLog = {
  id: number;
  action: string;
  actor: string;
  data: Record<string, unknown> | null;
  created_at: string;
};

export type HealthStatus = {
  status: string;
  mqtt: string;
  influx: string;
};

export type User = {
  email: string;
  role: string;
};
