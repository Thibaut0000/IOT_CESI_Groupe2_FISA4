import express from "express";
import cors from "cors";
import http from "http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { initWebSocket, broadcast } from "./ws.js";
import { startMqtt } from "./services/mqtt.js";
import { checkOffline, listDevices } from "./services/deviceRegistry.js";
import { initInflux } from "./services/influx.js";

// Routes
import authRoutes from "./routes/auth.js";
import devicesRoutes from "./routes/devices.js";
import metricsRoutes from "./routes/metrics.js";
import adminRoutes from "./routes/admin.js";
import { authenticate } from "./middleware/auth.js";

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

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const server = http.createServer(app);

initWebSocket(server);

// Init InfluxDB then start MQTT
initInflux()
  .then(() => {
    logger.info({ msg: "influxdb initialized" });
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
      status: d.status,
      lastSeen: d.lastSeen
    });
  });
}, 5000);

server.listen(config.apiPort, () => {
  logger.info({ msg: "api started", port: config.apiPort });
});
