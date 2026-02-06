export type Role = "admin" | "user";

export type DeviceStatus = "ONLINE" | "OFFLINE";

export type Device = {
  deviceId: string;
  lastSeen: number;
  status: DeviceStatus;
  latestNoiseDb?: number;
};

export type NoiseDataPoint = {
  _time: string;
  _value: number;
};

export type Threshold = {
  deviceId: string | null;
  thresholdDb: number;
};

export type WsEvent =
  | { type: "noise"; deviceId: string; noiseDb: number; ts: number }
  | { type: "alert"; deviceId: string; noiseDb: number; thresholdDb: number; ts: number }
  | { type: "device_status"; deviceId: string; status: DeviceStatus; lastSeen: number }
  | { type: "thresholds"; thresholds: Threshold[] };

export type AuditLog = {
  id: number;
  action: string;
  actor: string;
  data: Record<string, unknown> | null;
  created_at: string;
};
