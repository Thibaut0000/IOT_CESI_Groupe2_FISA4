import { Router } from "express";
import { listDevices, getDevice } from "../services/deviceRegistry.js";

const router = Router();

router.get("/", (_req, res) => {
  const devices = listDevices();
  return res.json(devices);
});

router.get("/:deviceId", (req, res) => {
  const device = getDevice(req.params.deviceId);
  if (!device) return res.status(404).json({ error: "Device not found" });
  return res.json(device);
});

export default router;
