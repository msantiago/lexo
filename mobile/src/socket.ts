import { io, type Socket } from "socket.io-client";

export type ConnectionState = "connecting" | "connected" | "disconnected";

/** Backend URL for the mobile client (same Express + Socket.IO server as web). */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Local default: Expo web / device talking to the Lexo server on the host.
  return "http://127.0.0.1:3001";
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      autoConnect: true,
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { tabId: `mobile-${Math.random().toString(36).slice(2)}` },
    });
  }
  return socket;
}
