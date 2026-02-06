import { dbClient } from "../db/index.js";

// Insert a noise reading into local SQLite history
export const insertNoiseHistory = (deviceId: string, noiseDb: number, tsMs: number) => {
  dbClient
    .prepare("INSERT INTO noise_history (device_id, noise_db, ts) VALUES (?, ?, ?)")
    .run(deviceId, noiseDb, tsMs);
};

// Get history for a device over the last N minutes
export const getNoiseHistory = (deviceId: string, minutes: number) => {
  const since = Date.now() - minutes * 60 * 1000;
  const rows = dbClient
    .prepare(
      `SELECT noise_db, ts FROM noise_history 
       WHERE device_id = ? AND ts >= ? 
       ORDER BY ts ASC`
    )
    .all(deviceId, since) as Array<{ noise_db: number; ts: number }>;

  return rows.map((r) => ({
    _time: new Date(r.ts).toISOString(),
    _value: r.noise_db
  }));
};

// Get aggregated stats for a device
export const getNoiseStats = (deviceId: string, minutes: number) => {
  const since = Date.now() - minutes * 60 * 1000;
  const result = dbClient
    .prepare(
      `SELECT 
        COUNT(*) as count,
        AVG(noise_db) as avg,
        MIN(noise_db) as min,
        MAX(noise_db) as max
       FROM noise_history 
       WHERE device_id = ? AND ts >= ?`
    )
    .get(deviceId, since) as { count: number; avg: number | null; min: number | null; max: number | null };

  if (!result || result.count === 0) {
    return { count: 0, avg: null, min: null, max: null };
  }

  return {
    count: result.count,
    avg: result.avg ? Math.round(result.avg * 10) / 10 : null,
    min: result.min,
    max: result.max
  };
};
