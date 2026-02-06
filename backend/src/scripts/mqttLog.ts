import mqtt from "mqtt";
import { config } from "../config.js";

const buildUrl = () => {
  const protocol = config.mqtt.tls ? "mqtts" : "mqtt";
  return `${protocol}://${config.mqtt.host}:${config.mqtt.port}`;
};

const client = mqtt.connect(buildUrl(), {
  username: config.mqtt.username,
  password: config.mqtt.password,
  reconnectPeriod: 2000
});

client.on("connect", () => {
  console.log("[MQTT] connected", buildUrl());
  client.subscribe("campus/bruit/+/data", { qos: 0 });
});

client.on("message", (_topic, payload) => {
  try {
    const parsed = JSON.parse(payload.toString()) as { sensor?: string; noise_db?: number; ts?: number };
    console.log(`[DATA] sensor=${parsed.sensor} noise_db=${parsed.noise_db} ts=${parsed.ts}`);
  } catch (e) {
    console.log("[DATA] raw:", payload.toString());
  }
});

client.on("error", (err) => {
  console.error("[MQTT] error", err);
});
