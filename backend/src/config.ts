import dotenv from "dotenv";

dotenv.config();

const toBool = (value: string | undefined) => value === "true" || value === "1";

export const config = {
  env: process.env.APP_ENV ?? "local",
  apiPort: Number(process.env.API_PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  mqtt: {
    host: process.env.MQTT_HOST ?? "localhost",
    port: Number(process.env.MQTT_PORT ?? 1883),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    tls: toBool(process.env.MQTT_TLS),
    caCert: process.env.MQTT_CA_CERT || undefined
  },
  influx: {
    url: process.env.INFLUX_URL ?? "http://localhost:8086",
    token: process.env.INFLUX_TOKEN ?? "",
    org: process.env.INFLUX_ORG ?? "cesi",
    bucket: process.env.INFLUX_BUCKET ?? "bruit"
  },
  offlineThresholdSeconds: Number(process.env.OFFLINE_THRESHOLD_SECONDS ?? 10)
};