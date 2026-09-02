import express from "express";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { GameSettings } from "../shared/types.ts";
import { dictionary } from "./dictionary.ts";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  leaveSocket,
  rejoinRoom,
  setBroadcast,
  startGame,
  submitWord,
  updateSettings,
  viewFor,
  voteReroll,
  adoptRejectedWord,
} from "./rooms.ts";

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, words: dictionary.size });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.use((_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

setBroadcast((room, event, payload) => {
  for (const player of room.players) {
    if (!player.socketId) continue;
    if (event === "room:state") {
      io.to(player.socketId).emit("room:state", viewFor(room, player.id));
    } else {
      io.to(player.socketId).emit(event, payload);
    }
  }
});

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }: { name?: string; solo?: boolean }) => {
    try {
      const { room, playerId } = createRoom(socket.id, name ?? "");
      socket.emit("session", { playerId, code: room.code });
      socket.emit("room:state", viewFor(room, playerId));
    } catch (err) {
      socket.emit("notice", { message: "Impossible de créer le salon" });
      console.error(err);
    }
  });

  socket.on("room:join", ({ code, name }: { code?: string; name?: string }) => {
    const result = joinRoom(socket.id, code ?? "", name ?? "");
    if ("error" in result) {
      socket.emit("notice", { message: result.error });
      return;
    }
    socket.emit("session", { playerId: result.playerId, code: result.room.code });
    socket.emit("room:state", viewFor(result.room, result.playerId));
  });

  socket.on(
    "room:rejoin",
    ({ code, playerId }: { code?: string; playerId?: string }) => {
      const result = rejoinRoom(socket.id, code ?? "", playerId ?? "");
      if ("error" in result) {
        socket.emit("notice", { message: result.error });
        return;
      }
      socket.emit("session", { playerId: result.playerId, code: result.room.code });
      socket.emit("room:state", viewFor(result.room, result.playerId));
    },
  );

  socket.on("room:settings", (settings: Partial<GameSettings>) => {
    const result = updateSettings(socket.id, settings);
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("game:start", () => {
    const result = startGame(socket.id);
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("game:word", ({ cells }: { cells?: number[] }) => {
    const result = submitWord(socket.id, cells ?? []);
    socket.emit("word:result", result);
  });

  socket.on("game:reroll", () => {
    const result = voteReroll(socket.id);
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("dict:add", ({ key }: { key?: string }) => {
    const result = adoptRejectedWord(socket.id, key ?? "");
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("room:leave", () => {
    leaveRoom(socket.id);
  });

  socket.on("disconnect", () => {
    leaveSocket(socket.id);
  });
});

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal) continue;
      if (addr.family !== "IPv4" && addr.family !== 4) continue;
      out.push(addr.address);
    }
  }
  return out;
}

console.log(`Lexo dictionary: ${dictionary.size} formes`);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Lexo server on http://127.0.0.1:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`Lexo réseau : http://${ip}:${PORT}`);
    console.log(`App (dev)  : http://${ip}:5173`);
  }
});

process.on("uncaughtException", (err) => {
  console.error(err);
});
