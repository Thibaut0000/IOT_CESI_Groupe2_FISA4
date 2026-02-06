import { Router } from "express";
import { z } from "zod";
import { queryLatest, queryHistory, queryStats } from "../services/influx.js";

const router = Router();

router.get("/latest", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  try {
    const result = await queryLatest(deviceId.data);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

router.get("/history", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  const minutes = z.coerce.number().positive().default(30).safeParse(req.query.minutes);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  try {
    const data = await queryHistory(deviceId.data, minutes.success ? minutes.data : 30);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

router.get("/stats", async (req, res) => {
  const deviceId = z.string().safeParse(req.query.deviceId);
  const minutes = z.coerce.number().positive().default(60).safeParse(req.query.minutes);
  if (!deviceId.success) return res.status(400).json({ error: "Missing deviceId" });

  try {
    const data = await queryStats(deviceId.data, minutes.success ? minutes.data : 60);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "InfluxDB query failed" });
  }
});

export default router;
