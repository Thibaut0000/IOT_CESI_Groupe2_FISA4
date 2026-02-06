import { dbClient } from "../db/index.js";

type AuditRow = {
  id: number;
  action: string;
  actor: string;
  data: string | null;
  created_at: string;
};

export const writeAudit = (action: string, actor: string, data?: Record<string, unknown>) => {
  const stmt = dbClient.prepare(
    "INSERT INTO audit_logs (action, actor, data) VALUES (@action, @actor, @data)"
  );
  stmt.run({ action, actor, data: data ? JSON.stringify(data) : null });
};

export const listAudit = (limit = 100) => {
  const stmt = dbClient.prepare(
    "SELECT id, action, actor, data, created_at FROM audit_logs ORDER BY id DESC LIMIT ?"
  );
  return (stmt.all(limit) as AuditRow[]).map((row) => ({
    ...row,
    data: row.data ? JSON.parse(row.data) : null
  }));
};