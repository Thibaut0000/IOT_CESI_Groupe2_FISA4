import mqtt from "mqtt";
import fs from "fs";
import { config } from "../config.js";

const buildUrl = () => {
  const protocol = config.mqtt.tls ? "mqtts" : "mqtt";
  return `${protocol}://${config.mqtt.host}:${config.mqtt.port}`;
};

const tlsOptions = config.mqtt.tls && config.mqtt.caCert
  ? { ca: fs.readFileSync(config.mqtt.caCert), rejectUnauthorized: true }
  : {};

const client = mqtt.connect(buildUrl(), {
  username: config.mqtt.username,
  password: config.mqtt.password,
  reconnectPeriod: 2000,
  ...tlsOptions
});

client.on("connect", () => {
  console.log("[MQTT] connected", buildUrl());
  // Subscribe to the real topics
  client.subscribe("$SYS/#", { qos: 0 });
  client.subscribe("campus/#", { qos: 0 });
  client.subscribe("bruit/#", { qos: 0 });
  client.subscribe("A/#", { qos: 0 });
  client.subscribe("data/#", { qos: 0 });
  console.log("[MQTT] subscribed to: $SYS/#, campus/#, bruit/#, A/#, data/#");
});

client.on("message", (_topic, payload) => {
  try {
    const parsed = JSON.parse(payload.toString()) as { sensor?: string; noise_db?: number; ts?: number };
    console.log(`[DATA] topic=${_topic} sensor=${parsed.sensor} noise_db=${parsed.noise_db} ts=${parsed.ts}`);
  } catch (e) {
    console.log(`[DATA] topic=${_topic} raw:`, payload.toString().substring(0, 200));
  }
});

client.on("error", (err) => {
  console.error("[MQTT] error", err);
});
