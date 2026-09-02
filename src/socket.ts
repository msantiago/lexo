import { io, type Socket } from "socket.io-client";
import type { GameSettings, RoomView, WordSubmitResult } from "@shared/types";

export type ServerToClient = {
  "room:state": (room: RoomView) => void;
  session: (data: { playerId: string; code: string }) => void;
  "word:result": (result: WordSubmitResult) => void;
  "word:shared": (data: { key: string }) => void;
  notice: (data: { message: string }) => void;
};

export type ClientToServer = {
  "room:create": (data: { name: string; solo?: boolean }) => void;
  "room:join": (data: { code: string; name: string }) => void;
  "room:rejoin": (data: { code: string; playerId: string }) => void;
  "room:settings": (settings: Partial<GameSettings>) => void;
  "game:start": () => void;
  "game:word": (data: { cells: number[] }) => void;
  "game:reroll": () => void;
  "dict:add": (data: { key: string }) => void;
};

const socketUrl =
  import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : undefined;

export const socket: Socket<ServerToClient, ClientToServer> = io(socketUrl, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
