import mqtt from "mqtt";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { writeNoisePoint, queryThresholdForDevice } from "./influx.js";
import { updateDevice } from "./deviceRegistry.js";
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

    // Subscribe to real sensor topics only
    client.subscribe("$SYS/#", { qos: 0 });
    client.subscribe("campus/#", { qos: 0 });
    client.subscribe("bruit/#", { qos: 0 });
    client.subscribe("A/#", { qos: 0 });
    client.subscribe("data/#", { qos: 0 });

    logger.info({ msg: "mqtt subscribed to topics", topics: ["$SYS/#", "campus/#", "bruit/#", "A/#", "data/#"] });
  });

  client.on("error", (err) => {
    logger.error({ msg: "mqtt error", err });
  });

  client.on("message", async (topic, payload) => {
    // Log every message received for debugging
    logger.debug({ msg: "mqtt raw message", topic, payload: payload.toString().substring(0, 200) });

    // Try to parse noise data from any topic
    try {
      const parsed = JSON.parse(payload.toString());
      const result = noiseSchema.safeParse(parsed);

      if (result.success) {
        const data = result.data;
        const deviceId = data.sensor;
        const tsMs = normalizeTimestampMs(data.ts);

        updateDevice(deviceId, data.noise_db);

        // Write to InfluxDB
        await writeNoisePoint(deviceId, data.noise_db, tsMs).catch(err => {
          logger.warn({ msg: "influxdb write failed", deviceId, err: String(err) });
        });

        const threshold = await queryThresholdForDevice(deviceId).catch(() => null);
        const isAlert = threshold !== null && data.noise_db >= threshold;

        logger.info({ msg: "noise data received", topic, deviceId, noiseDb: data.noise_db, ts: tsMs });

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
        return;
      }
    } catch {
      // Not JSON or not noise data — that's fine, just log it
    }

    // For $SYS topics, just log
    if (topic.startsWith("$SYS/")) {
      logger.debug({ msg: "mqtt $SYS", topic, value: payload.toString().substring(0, 100) });
      return;
    }

    // For any other message, log it
    logger.debug({ msg: "mqtt message (non-noise)", topic, payload: payload.toString().substring(0, 200) });
  });

  return client;
};