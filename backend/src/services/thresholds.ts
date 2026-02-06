import { dbClient } from "../db/index.js";

export type Threshold = { deviceId: string | null; thresholdDb: number };

type ThresholdRow = { device_id: string | null; threshold_db: number };

export const getThresholds = (): Threshold[] => {
  const stmt = dbClient.prepare("SELECT device_id, threshold_db FROM thresholds");
  return (stmt.all() as ThresholdRow[]).map((row) => ({ deviceId: row.device_id, thresholdDb: row.threshold_db }));
};

export const getThresholdForDevice = (deviceId: string): number | null => {
  const stmt = dbClient.prepare(
    "SELECT threshold_db FROM thresholds WHERE device_id = ?"
  );
  const row = stmt.get(deviceId) as { threshold_db?: number } | undefined;
  if (row?.threshold_db !== undefined) return row.threshold_db;
  const globalStmt = dbClient.prepare(
    "SELECT threshold_db FROM thresholds WHERE device_id IS NULL"
  );
  const global = globalStmt.get() as { threshold_db?: number } | undefined;
  return global?.threshold_db ?? null;
};

export const upsertThreshold = (deviceId: string | null, thresholdDb: number) => {
  const stmt = dbClient.prepare(
    "INSERT INTO thresholds (device_id, threshold_db) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET threshold_db = excluded.threshold_db, updated_at = datetime('now')"
  );
  stmt.run(deviceId, thresholdDb);
};