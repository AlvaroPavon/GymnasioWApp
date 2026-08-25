import { API_BASE_URL } from './api';

export function realtimeUrl() {
  const base = API_BASE_URL || window.location.origin;
  const url = new URL('/api/realtime', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function subscribeToRealtime(onDataChanged, onStatus) {
  const token = localStorage.getItem('token');
  if (!token) return () => {};

  let socket;
  let closedByClient = false;
  let reconnectTimer;
  let attempts = 0;

  const connect = () => {
    onStatus?.('connecting');
    socket = new WebSocket(realtimeUrl());

    socket.onopen = () => {
      attempts = 0;
      socket.send(JSON.stringify({ type: 'AUTH', token }));
    };

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type === 'CONNECTED') onStatus?.('connected');
        if (event.type === 'DATA_CHANGED') onDataChanged(event);
      } catch {
        // Ignore malformed realtime messages.
      }
    };

    socket.onclose = () => {
      onStatus?.('disconnected');
      if (closedByClient) return;
      const delay = Math.min(1000 * 2 ** attempts, 15000);
      attempts += 1;
      reconnectTimer = window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();

  return () => {
    closedByClient = true;
    window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
