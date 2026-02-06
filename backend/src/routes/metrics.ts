import { Router } from "express";
import { z } from "zod";
import { getNoiseHistory, getNoiseStats } from "../services/historyLocal.js";

const router = Router();

router.get("/latest", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  // Get most recent from history
  const history = getNoiseHistory(deviceId.data, 1);
  if (history.length === 0) return res.json(null);
  return res.json(history[history.length - 1]);
});

router.get("/history", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  const minutes = z.coerce.number().positive().default(30).safeParse(req.query.minutes);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  const data = getNoiseHistory(deviceId.data, minutes.success ? minutes.data : 30);
  return res.json(data);
});

router.get("/stats", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  const minutes = z.coerce.number().positive().default(60).safeParse(req.query.minutes);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  const data = getNoiseStats(deviceId.data, minutes.success ? minutes.data : 60);
  return res.json(data);
});

export default router;
