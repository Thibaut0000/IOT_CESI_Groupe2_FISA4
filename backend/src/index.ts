import express from "express";
import cors from "cors";
import http from "http";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { initWebSocket, broadcast } from "./ws.js";
import { startMqtt, getMqttStatus } from "./services/mqtt.js";
import { checkOffline, listDevices } from "./services/deviceRegistry.js";
import { initInflux, queryUsers, writeUser } from "./services/influx.js";

// Routes
import authRoutes from "./routes/auth.js";
import devicesRoutes from "./routes/devices.js";
import metricsRoutes from "./routes/metrics.js";
import adminRoutes from "./routes/admin.js";
import { authenticate } from "./middleware/auth.js";

let influxReady = false;

const app = express();

app.use(cors());
app.use(express.json());

// Public routes
app.use("/auth", authRoutes);

// Protected routes (any auth)
app.use("/devices", authenticate, devicesRoutes);
app.use("/metrics", authenticate, metricsRoutes);

// Admin routes
app.use("/admin", adminRoutes);

// Health check with service statuses
app.get("/health", (_req, res) => res.json({
  status: "ok",
  mqtt: getMqttStatus(),
  influx: influxReady ? "connected" : "disconnected"
}));

const server = http.createServer(app);

initWebSocket(server);

// Auto-create default admin if no users exist yet
const seedDefaultAdmin = async () => {
  try {
    const users = await queryUsers();
    if (users.length > 0) return;
    const { email, password } = config.defaultAdmin;
    const hash = await bcrypt.hash(password, 10);
    await writeUser(email, hash, "admin");
    logger.info({ msg: "default admin created", email });
  } catch (err) {
    logger.warn({ msg: "failed to seed default admin", err: String(err) });
  }
};

// Init InfluxDB then seed admin + start MQTT
initInflux()
  .then(async () => {
    influxReady = true;
    logger.info({ msg: "influxdb initialized" });
    await seedDefaultAdmin();
    startMqtt();
  })
  .catch((err) => {
    logger.warn({ msg: "influxdb init failed, starting mqtt anyway", err });
    startMqtt();
  });

// Periodically check offline status and broadcast
setInterval(() => {
  checkOffline();
  const devices = listDevices();
  devices.forEach((d) => {
    broadcast({
      type: "device_status",
      deviceId: d.deviceId,
      zone: d.zone,
      status: d.status,
      lastSeen: d.lastSeen
    });
  });
}, 5000);

server.listen(config.apiPort, () => {
  logger.info({ msg: "api started", port: config.apiPort });
});
