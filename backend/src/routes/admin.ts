import { Router } from "express";
import { z } from "zod";
import { getThresholds, upsertThreshold } from "../services/thresholds.js";
import { listAudit, writeAudit } from "../services/audit.js";
import { AuthedRequest, authenticate, requireRole } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// All routes require admin role
router.use(authenticate);
router.use(requireRole("admin"));

router.get("/thresholds", (_req, res) => {
  const thresholds = getThresholds();
  return res.json(thresholds);
});

const thresholdSchema = z.object({
  deviceId: z.string().nullable().optional(),
  thresholdDb: z.number()
});

router.post("/thresholds", (req: AuthedRequest, res) => {
  const parsed = thresholdSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });

  const { deviceId, thresholdDb } = parsed.data;
  upsertThreshold(deviceId ?? null, thresholdDb);
  writeAudit("set_threshold", req.user!.email, { deviceId, thresholdDb });
  broadcast({ type: "thresholds", thresholds: getThresholds() });

  return res.json({ success: true });
});

router.get("/audit", (_req, res) => {
  const logs = listAudit(100);
  return res.json(logs);
});

export default router;
