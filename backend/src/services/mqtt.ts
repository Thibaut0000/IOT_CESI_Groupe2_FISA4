import mqtt from "mqtt";
import fs from "fs";
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
  const tlsOptions = config.mqtt.tls && config.mqtt.caCert
    ? { ca: fs.readFileSync(config.mqtt.caCert) }
    : {};

  if (config.mqtt.tls && !config.mqtt.caCert) {
    logger.warn({ msg: "mqtt tls enabled but MQTT_CA_CERT not set; broker cert will not be verified" });
  }

  const client = mqtt.connect(buildUrl(), {
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 2000,
    clean: false,        // persistent session: broker queues QoS 1 messages while we are offline
    clientId: `iot-api-${process.pid}`,
    ...(config.mqtt.tls ? { rejectUnauthorized: true } : {}),
    ...tlsOptions
  });

  logger.info({
    msg: "mqtt client options",
    cleanSession: false,
    clientId: `iot-api-${process.pid}`,
    reconnectPeriod: 2000,
    tls: config.mqtt.tls,
    broker: buildUrl()
  });

  client.on("connect", () => {
    mqttStatus = "connected";
    logger.info({ msg: "mqtt connected", broker: buildUrl() });

    // ── QoS strategy ────────────────────────────────────────────────
    // • db  (noise telemetry) → QoS 0 : best-effort, high frequency,
    //   losing one sample is acceptable (next arrives in < 5 s).
    // • status (online/offline) → QoS 1 : at-least-once delivery,
    //   missing a status change could leave a device shown as ONLINE
    //   when it is actually OFFLINE. retain=true on publish side so
    //   new subscribers get the last known state immediately.
    // • $SYS → QoS 0 : broker diagnostics, best-effort.
    // ────────────────────────────────────────────────────────────────

    client.subscribe("campus/bruit/+/db", { qos: 0 }, (err, granted) => {
      if (err) { logger.error({ msg: "mqtt subscribe error", topic: "campus/bruit/+/db", err }); return; }
      logger.info({ msg: "mqtt subscribed", topic: granted![0].topic, qos: granted![0].qos, reason: "QoS 0 – best-effort telemetry, high frequency" });
    });

    client.subscribe("campus/bruit/+/status", { qos: 1 }, (err, granted) => {
      if (err) { logger.error({ msg: "mqtt subscribe error", topic: "campus/bruit/+/status", err }); return; }
      logger.info({ msg: "mqtt subscribed", topic: granted![0].topic, qos: granted![0].qos, reason: "QoS 1 – at-least-once, critical state change" });
    });

    client.subscribe("$SYS/#", { qos: 0 }, (err, granted) => {
      if (err) { logger.error({ msg: "mqtt subscribe error", topic: "$SYS/#", err }); return; }
      logger.info({ msg: "mqtt subscribed", topic: granted![0].topic, qos: granted![0].qos, reason: "QoS 0 – broker diagnostics" });
    });
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
    logger.info({ msg: "mqtt reconnecting", cleanSession: false, note: "persistent session – broker will deliver queued QoS 1 messages" });
  });

  // ── Protocol-level logging (proves QoS handshake) ──────────────
  client.on("packetsend", (packet: any) => {
    if (packet.cmd === "subscribe") {
      logger.debug({ msg: "mqtt SUBSCRIBE sent", subscriptions: packet.subscriptions });
    }
    if (packet.cmd === "puback") {
      logger.debug({ msg: "mqtt PUBACK sent", messageId: packet.messageId, note: "acknowledging QoS 1 message from broker" });
    }
  });

  client.on("packetreceive", (packet: any) => {
    if (packet.cmd === "suback") {
      logger.info({ msg: "mqtt SUBACK received", granted: packet.granted, note: "broker confirmed subscription QoS levels" });
    }
    if (packet.cmd === "publish" && packet.qos === 1) {
      logger.debug({ msg: "mqtt QoS 1 PUBLISH received", topic: packet.topic, messageId: packet.messageId, retain: packet.retain, dup: packet.dup });
    }
  });

  client.on("message", async (topic, payload, packet) => {
    const qos = (packet as any).qos ?? 0;
    const retain = (packet as any).retain ?? false;
    logger.debug({ msg: "mqtt raw message", topic, qos, retain, payload: payload.toString().substring(0, 200) });

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

      logger.info({
        msg: "device status from sensor",
        deviceId,
        zone,
        online,
        qos,
        retain,
        note: qos === 1
          ? "QoS 1 – delivery guaranteed by broker (PUBACK)"
          : "QoS 0 – best-effort (consider publishing with QoS 1)",
        retainNote: retain
          ? "retained message – last known state delivered to new subscriber"
          : "non-retained – only live subscribers received this"
      });

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

      logger.info({ msg: "noise data received", topic, deviceId, zone, noiseDb, ts: tsMs, qos, retain });

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