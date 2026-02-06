import mqtt from "mqtt";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { writeNoisePoint, queryThresholdForDevice } from "./influx.js";
import { updateDevice, setDeviceStatus } from "./deviceRegistry.js";
import { broadcast } from "../ws.js";

// campus/bruit/<zone>/db  →  { db: number, sensorId: string, zone: string, ts: number }
const dbSchema = z.object({
  db: z.number(),
  sensorId: z.string().min(1),
  zone: z.string().min(1),
  ts: z.number()
});

// campus/bruit/<zone>/status  →  { online: boolean, sensorId: string, zone: string, ts: number }
const statusSchema = z.object({
  online: z.boolean(),
  sensorId: z.string().min(1),
  zone: z.string().min(1),
  ts: z.number()
});

let mqttStatus: "connected" | "disconnected" | "reconnecting" = "disconnected";

export const getMqttStatus = () => mqttStatus;

const buildUrl = () => {
  const protocol = config.mqtt.tls ? "mqtts" : "mqtt";
  return `${protocol}://${config.mqtt.host}:${config.mqtt.port}`;
};

const normalizeTimestampMs = (sensorTs: number) => {
  if (sensorTs >= 1e12) return sensorTs; // already ms epoch
  if (sensorTs >= 1e9) return sensorTs * 1000; // seconds epoch
  return Date.now(); // fallback for counters/relative values
};

export const startMqtt = () => {
  const client = mqtt.connect(buildUrl(), {
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 2000
  });

  client.on("connect", () => {
    mqttStatus = "connected";
    logger.info({ msg: "mqtt connected", broker: buildUrl() });

    // Subscribe to sensor topics: campus/bruit/<zone>/db and campus/bruit/<zone>/status
    client.subscribe("campus/bruit/+/db", { qos: 0 });
    client.subscribe("campus/bruit/+/status", { qos: 0 });
    client.subscribe("$SYS/#", { qos: 0 });

    logger.info({ msg: "mqtt subscribed to topics", topics: ["campus/bruit/+/db", "campus/bruit/+/status", "$SYS/#"] });
  });

  client.on("error", (err) => {
    mqttStatus = "disconnected";
    logger.error({ msg: "mqtt error", err });
  });

  client.on("close", () => {
    mqttStatus = "reconnecting";
  });

  client.on("reconnect", () => {
    mqttStatus = "reconnecting";
  });

  client.on("message", async (topic, payload) => {
    logger.debug({ msg: "mqtt raw message", topic, payload: payload.toString().substring(0, 200) });

    // $SYS topics – just log
    if (topic.startsWith("$SYS/")) {
      logger.debug({ msg: "mqtt $SYS", topic, value: payload.toString().substring(0, 100) });
      return;
    }

    // Parse topic: campus/bruit/<zone>/<type>
    const parts = topic.split("/");
    if (parts.length < 4 || parts[0] !== "campus" || parts[1] !== "bruit") {
      logger.debug({ msg: "mqtt message (ignored topic)", topic });
      return;
    }

    const zone = parts[2];
    const msgType = parts[3]; // "db" or "status"

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      logger.warn({ msg: "mqtt invalid JSON", topic });
      return;
    }

    // ── Handle status messages ──────────────────────────────────
    if (msgType === "status") {
      const result = statusSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ msg: "mqtt status parse failed", topic, errors: result.error.errors });
        return;
      }
      const { sensorId, online, ts } = result.data;
      const deviceId = sensorId;
      const tsMs = normalizeTimestampMs(ts);
      const status = online ? "ONLINE" as const : "OFFLINE" as const;

      setDeviceStatus(deviceId, zone, status);

      logger.info({ msg: "device status from sensor", deviceId, zone, online });

      broadcast({
        type: "device_status",
        deviceId,
        zone,
        status,
        lastSeen: tsMs
      });
      return;
    }

    // ── Handle db (noise) messages ──────────────────────────────
    if (msgType === "db") {
      const result = dbSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ msg: "mqtt db parse failed", topic, errors: result.error.errors });
        return;
      }
      const { db: noiseDb, sensorId, ts } = result.data;
      const deviceId = sensorId;
      const tsMs = normalizeTimestampMs(ts);

      updateDevice(deviceId, zone, noiseDb);

      // Write to InfluxDB
      await writeNoisePoint(deviceId, noiseDb, tsMs).catch(err => {
        logger.warn({ msg: "influxdb write failed", deviceId, err: String(err) });
      });

      const threshold = await queryThresholdForDevice(deviceId).catch(() => null);
      const isAlert = threshold !== null && noiseDb >= threshold;

      logger.info({ msg: "noise data received", topic, deviceId, zone, noiseDb, ts: tsMs });

      broadcast({
        type: "noise",
        deviceId,
        zone,
        noiseDb,
        ts: tsMs
      });

      if (isAlert) {
        broadcast({
          type: "alert",
          deviceId,
          zone,
          noiseDb,
          thresholdDb: threshold,
          ts: tsMs
        });
      }
      return;
    }

    logger.debug({ msg: "mqtt message (unknown subtype)", topic, payload: payload.toString().substring(0, 200) });
  });

  return client;
};