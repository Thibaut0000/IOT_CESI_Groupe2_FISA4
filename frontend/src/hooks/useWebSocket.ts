import { useEffect, useRef, useCallback } from "react";
import { useDataStore } from "../stores/dataStore";
import { useAuthStore } from "../stores/authStore";
import type { WsEvent } from "../types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000/ws";

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const handleWsEvent = useDataStore((s) => s.handleWsEvent);
  const token = useAuthStore((s) => s.token);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => console.log("[WS] connected");

    ws.onmessage = (ev) => {
      try {
        const event: WsEvent = JSON.parse(ev.data);
        handleWsEvent(event);
      } catch (e) {
        console.warn("[WS] invalid message", e);
      }
    };

    ws.onclose = () => {
      console.log("[WS] closed, reconnecting...");
      reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
    };

    ws.onerror = (err) => console.error("[WS] error", err);
  }, [handleWsEvent, token]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);
};
