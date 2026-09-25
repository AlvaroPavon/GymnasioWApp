import { getApiOrigin } from "./config";

export const toRealtimeUrl = () => {
  const origin = getApiOrigin();
  if (!origin) {
    throw new Error("EXPO_PUBLIC_API_URL es obligatoria para la sincronización en tiempo real.");
  }

  const websocketOrigin = origin.startsWith("https://")
    ? `wss://${origin.slice("https://".length)}`
    : origin.startsWith("http://")
      ? `ws://${origin.slice("http://".length)}`
      : origin;

  return `${websocketOrigin}/api/realtime`;
};

export function connectRealtime(token, onDataChanged, onStatus = () => {}) {
  let socket;
  let reconnectTimer;
  let active = true;
  let retryMs = 1000;

  const scheduleReconnect = () => {
    if (!active) return;
    onStatus("connecting");
    reconnectTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 1.8, 15000);
  };

  const connect = () => {
    if (!active || !token) return;

    onStatus("connecting");
    socket = new WebSocket(toRealtimeUrl());

    socket.onopen = () => {
      retryMs = 1000;
      socket.send(JSON.stringify({ type: "AUTH", token }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "CONNECTED") {
          onStatus("connected");
        }
        if (message?.type === "DATA_CHANGED") {
          onDataChanged(message);
        }
      } catch {
        // Ignore malformed realtime messages.
      }
    };

    socket.onerror = () => {
      onStatus("disconnected");
    };

    socket.onclose = () => {
      onStatus("disconnected");
      scheduleReconnect();
    };
  };

  connect();

  return () => {
    active = false;
    clearTimeout(reconnectTimer);
    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }
  };
}
