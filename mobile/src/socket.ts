import { io, type Socket } from "socket.io-client";
import type { GameSettings, LobbyRoom, RoomView, WordSubmitResult } from "@shared/types";
import { apiBaseUrl } from "./api";
import { authClient } from "./auth-client";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export type ServerToClient = {
  "room:state": (room: RoomView) => void;
  "lobby:rooms": (rooms: LobbyRoom[]) => void;
  session: (data: { playerId: string; code: string; observing?: boolean }) => void;
  "session:replaced": () => void;
  "session:role": (data: { admin: boolean }) => void;
  "room:closed": () => void;
  "word:result": (result: WordSubmitResult) => void;
  "word:shared": (data: { key: string }) => void;
  "player:trace": (data: { playerId: string; cells: number[] }) => void;
  notice: (data: { message: string }) => void;
};

export type ClientToServer = {
  "lobby:list": () => void;
  "room:create": (data: { name: string; solo?: boolean }) => void;
  "room:join": (data: { code: string; name: string }) => void;
  "room:observe": (data: { code: string; name: string }) => void;
  "room:watch": (data: { userId: string; name: string }) => void;
  "room:rejoin": (data: { code: string; playerId: string }) => void;
  "room:settings": (settings: Partial<GameSettings>) => void;
  "room:leave": () => void;
  "game:start": () => void;
  "game:ready": () => void;
  "game:rematch": () => void;
  "game:word": (data: { cells: number[] }) => void;
  "game:trace": (data: { cells: number[] }) => void;
  "dict:add": (data: { key: string }) => void;
  "chat:send": (data: { text: string }) => void;
  "chat:like": (data: { key: string }) => void;
};

let socket: Socket<ServerToClient, ClientToServer> | null = null;
let tabId = `mobile-${Math.random().toString(36).slice(2)}`;

async function cookieHeader(): Promise<string | undefined> {
  try {
    const cookie = await authClient.getCookie();
    return cookie || undefined;
  } catch {
    return undefined;
  }
}

export function getSocket(): Socket<ServerToClient, ClientToServer> {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { tabId },
    });
  }
  return socket;
}

/** (Re)connect with the current Better Auth cookie so the server sees the session. */
export async function connectSocket(): Promise<Socket<ServerToClient, ClientToServer>> {
  const sock = getSocket();
  const cookie = await cookieHeader();
  sock.auth = { tabId };
  if (cookie) {
    sock.io.opts.extraHeaders = { cookie };
  } else {
    delete sock.io.opts.extraHeaders;
  }
  if (sock.connected) {
    sock.disconnect();
  }
  sock.connect();
  return sock;
}

export async function refreshSocketAuth(): Promise<void> {
  await connectSocket();
}

export { apiBaseUrl };
