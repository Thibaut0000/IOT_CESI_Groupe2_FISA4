import { Router } from "express";
import { listDevices, getDevice, setDeviceEnabled, setDeviceEcoMode } from "../services/deviceRegistry.js";
import { publishCommand } from "../services/mqtt.js";
import { broadcast } from "../ws.js";

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

/**
 * POST /devices/:deviceId/enable
 * Body: { enabled: boolean }
 * Sends ENABLE or DISABLE command to the sensor via MQTT → gateway → Zigbee
 */
router.post("/:deviceId/enable", (req, res) => {
  const { deviceId } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }

  const device = getDevice(deviceId);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const action = enabled ? "ENABLE" : "DISABLE";
  publishCommand(deviceId, action);

  // Optimistic update in registry
  setDeviceEnabled(deviceId, enabled);

  // Broadcast to all WebSocket clients
  broadcast({ type: "device_config", deviceId, enabled, ecoMode: undefined });

  return res.json({ ok: true, deviceId, enabled, action });
});

/**
 * POST /devices/:deviceId/eco
 * Body: { ecoMode: boolean }
 * Sends ECO_ON or ECO_OFF command to the sensor via MQTT → gateway → Zigbee
 */
router.post("/:deviceId/eco", (req, res) => {
  const { deviceId } = req.params;
  const { ecoMode } = req.body;

  if (typeof ecoMode !== "boolean") {
    return res.status(400).json({ error: "ecoMode must be a boolean" });
  }

  const device = getDevice(deviceId);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const action = ecoMode ? "ECO_ON" : "ECO_OFF";
  publishCommand(deviceId, action);

  // Optimistic update
  setDeviceEcoMode(deviceId, ecoMode);

  broadcast({ type: "device_config", deviceId, enabled: undefined, ecoMode });

  return res.json({ ok: true, deviceId, ecoMode, action });
});

export default router;
