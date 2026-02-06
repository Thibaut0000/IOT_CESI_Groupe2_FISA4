import mqtt from "mqtt";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { writeNoisePoint } from "./influx.js";
import { insertNoiseHistory } from "./historyLocal.js";
import { updateDevice } from "./deviceRegistry.js";
import { getThresholdForDevice } from "./thresholds.js";
import { broadcast } from "../ws.js";

const noiseSchema = z.object({
  sensor: z.string().min(1),
  noise_db: z.number(),
  ts: z.number()
});

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
    logger.info({ msg: "mqtt connected", broker: buildUrl() });
    client.subscribe("campus/bruit/+/data", { qos: 0 });
    client.subscribe("device/+/status", { qos: 1 });
  });

  client.on("error", (err) => {
    logger.error({ msg: "mqtt error", err });
  });

  client.on("message", async (topic, payload) => {
    if (topic.startsWith("campus/bruit/") && topic.endsWith("/data")) {
      try {
        const parsed = JSON.parse(payload.toString());
        const data = noiseSchema.parse(parsed);
        const deviceId = data.sensor;
        const tsMs = normalizeTimestampMs(data.ts);

        updateDevice(deviceId, data.noise_db);
        
        // Store in local SQLite history
        insertNoiseHistory(deviceId, data.noise_db, tsMs);
        
        // Write to InfluxDB (non-blocking, ignore errors if InfluxDB is down)
        writeNoisePoint(deviceId, data.noise_db, tsMs).catch(err => {
          logger.debug({ msg: "influxdb write skipped (not running)", deviceId });
        });

        const threshold = getThresholdForDevice(deviceId);
        const isAlert = threshold !== null && data.noise_db >= threshold;

        logger.info({ msg: "mqtt data received", deviceId, noiseDb: data.noise_db, ts: tsMs, sensorTs: data.ts });

        broadcast({
          type: "noise",
          deviceId,
          noiseDb: data.noise_db,
          ts: tsMs
        });

        if (isAlert) {
          broadcast({
            type: "alert",
            deviceId,
            noiseDb: data.noise_db,
            thresholdDb: threshold,
            ts: tsMs
          });
        }
      } catch (err) {
        logger.warn({ msg: "invalid mqtt payload", err, topic });
      }
    }

    if (topic.startsWith("device/") && topic.endsWith("/status")) {
      const deviceId = topic.split("/")[1];
      updateDevice(deviceId);
      broadcast({
        type: "device_status",
        deviceId,
        status: "ONLINE",
        lastSeen: Date.now()
      });
    }
  });

  return client;
};