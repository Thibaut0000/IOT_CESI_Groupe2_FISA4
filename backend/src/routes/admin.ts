import { Router } from "express";
import { z } from "zod";
import { queryThresholds, writeThreshold, queryAuditLogs, writeAuditPoint } from "../services/influx.js";
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

export default router;
