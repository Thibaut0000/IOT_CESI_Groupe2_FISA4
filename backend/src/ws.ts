import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger.js";

type WsEvent =
  | { type: "noise"; deviceId: string; zone: string; noiseDb: number; ts: number }
  | { type: "alert"; deviceId: string; zone: string; noiseDb: number; thresholdDb: number; ts: number }
  | { type: "device_status"; deviceId: string; zone: string; status: "ONLINE" | "OFFLINE"; lastSeen: number }
  | { type: "thresholds"; thresholds: Array<{ deviceId: string | null; thresholdDb: number }> }
  | { type: "device_config"; deviceId: string; enabled?: boolean; ecoMode?: boolean };

const clients = new Set<WebSocket>();
let wss: WebSocketServer | null = null;

export const initWebSocket = (server: any) => {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
  logger.info({ msg: "websocket started" });
};

export const broadcast = (event: WsEvent) => {
  const payload = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};