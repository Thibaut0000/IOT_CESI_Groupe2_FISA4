import Database from "better-sqlite3";
import { logger } from "../logger.js";

const db = new Database("./data/sqlite.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    threshold_db REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS thresholds_device_idx ON thresholds(device_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS noise_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    noise_db REAL NOT NULL,
    ts INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS noise_history_device_ts ON noise_history(device_id, ts DESC);
`);

// Clean old history data (keep only last 2 hours)
const cleanupHistory = () => {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  db.prepare("DELETE FROM noise_history WHERE ts < ?").run(twoHoursAgo);
};

// Run cleanup every 5 minutes
setInterval(cleanupHistory, 5 * 60 * 1000);
cleanupHistory();

logger.info({ msg: "sqlite initialized" });

export type DbUser = { id: number; email: string; password_hash: string; role: "admin" | "user" };
export type ThresholdRow = { id: number; device_id: string | null; threshold_db: number };

export const dbClient = db;