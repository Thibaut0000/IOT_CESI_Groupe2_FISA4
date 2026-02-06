import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { queryThresholds, writeThreshold, queryAuditLogs, writeAuditPoint, writeUser, queryUsers, queryHistory } from "../services/influx.js";
import { AuthedRequest, authenticate, requireRole } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// All routes require admin role
router.use(authenticate);
router.use(requireRole("admin"));

router.get("/thresholds", async (_req, res) => {
  try {
    const thresholds = await queryThresholds();
    return res.json(thresholds);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

const thresholdSchema = z.object({
  deviceId: z.string().nullable().optional(),
  thresholdDb: z.number()
});

router.post("/thresholds", async (req: AuthedRequest, res) => {
  const parsed = thresholdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });

  const { deviceId, thresholdDb } = parsed.data;

  try {
    await writeThreshold(deviceId ?? null, thresholdDb);
    await writeAuditPoint("set_threshold", req.user!.email, { deviceId, thresholdDb });
    const thresholds = await queryThresholds();
    broadcast({ type: "thresholds", thresholds });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB write failed" });
  }
});

router.get("/audit", async (_req, res) => {
  try {
    const logs = await queryAuditLogs(100);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

// User management
const userSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["admin", "user"])
});

router.get("/users", async (_req, res) => {
  try {
    const users = await queryUsers();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

router.post("/users", async (req: AuthedRequest, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error", details: parsed.error.errors });

  const { email, password, role } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  try {
    await writeUser(email, hash, role);
    await writeAuditPoint("create_user", req.user!.email, { email, role });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB write failed" });
  }
});

// CSV export
router.get("/export/csv", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  const minutes = z.coerce.number().positive().default(60).safeParse(req.query.minutes);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  try {
    const data = await queryHistory(deviceId.data, minutes.success ? minutes.data : 60);
    const header = "timestamp,noise_db\n";
    const rows = data.map((d: { _time: string; _value: number }) => `${d._time},${d._value}`).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=noise_${deviceId.data}_${Date.now()}.csv`);
    return res.send(header + rows);
  } catch (err) {
    return res.status(500).json({ error: "Export failed" });
  }
});

export default router;
