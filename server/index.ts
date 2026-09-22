import "./crypto-polyfill.ts";
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { toNodeHandler } from "better-auth/node";
import type { GameSettings } from "../shared/types.ts";
import { isAdminUser } from "./admin.ts";
import { auth, authProviders, migrateAuth, sessionFromHeaders } from "./auth.ts";
import { dictionary } from "./dictionary.ts";
import {
  closeRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  sendChat,
  toggleWordLike,
  leaveSocket,
  listAdminRooms,
  listPublicRooms,
  observeRoom,
  rejoinByUserId,
  rejoinRoom,
  setBroadcast,
  setLobbyBroadcast,
  setPlayerTrace,
  startGame,
  submitWord,
  updateSettings,
  viewFor,
  voteReroll,
  adoptRejectedWord,
} from "./rooms.ts";
import { hasUserAvatar, parseAvatarDataUrl, readUserAvatar, saveUserAvatar } from "./avatars.ts";
import { getGame, getProfile, listGames, migrateStore } from "./store.ts";

const PORT = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"], credentials: true },
  pingInterval: 10_000,
  pingTimeout: 10_000,
});

app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(express.json({ limit: "600kb" }));

app.get("/api/auth-config", (_req, res) => {
  res.json(authProviders);
});

app.get("/api/me/profile", async (req, res) => {
  const session = await sessionFromHeaders(req.headers);
  if (!session?.user) {
    res.status(401).json({ error: "Non connecté" });
    return;
  }
  res.json({ ...getProfile(session.user.id), hasCustomAvatar: hasUserAvatar(session.user.id) });
});

app.get("/api/me/games", async (req, res) => {
  const session = await sessionFromHeaders(req.headers);
  if (!session?.user) {
    res.status(401).json({ error: "Non connecté" });
    return;
  }
  res.json(listGames(session.user.id));
});

app.get("/api/avatars/:userId", (req, res) => {
  const bytes = readUserAvatar(String(req.params.userId ?? ""));
  if (!bytes) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(bytes);
});

app.head("/api/avatars/:userId", (req, res) => {
  if (!hasUserAvatar(String(req.params.userId ?? ""))) {
    res.status(404).end();
    return;
  }
  res.status(200).end();
});

app.post("/api/me/avatar", async (req, res) => {
  const session = await sessionFromHeaders(req.headers);
  if (!session?.user) {
    res.status(401).json({ error: "Non connecté" });
    return;
  }
  const raw = typeof req.body?.image === "string" ? req.body.image : "";
  const bytes = parseAvatarDataUrl(raw);
  if (!bytes) {
    res.status(400).json({ error: "Image invalide ou trop lourde." });
    return;
  }
  if (!saveUserAvatar(session.user.id, bytes)) {
    res.status(400).json({ error: "Impossible d’enregistrer la photo." });
    return;
  }
  const image = `/api/avatars/${session.user.id}?v=${Date.now()}`;
  res.json({ image });
});

app.get("/api/me/games/:id", async (req, res) => {
  const session = await sessionFromHeaders(req.headers);
  if (!session?.user) {
    res.status(401).json({ error: "Non connecté" });
    return;
  }
  const game = getGame(session.user.id, String(req.params.id ?? ""));
  if (!game) {
    res.status(404).json({ error: "Partie introuvable" });
    return;
  }
  res.json(game);
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
  if (event === "player:trace") {
    for (const observer of room.observers) {
      if (observer.socketId) io.to(observer.socketId).emit("player:trace", payload);
    }
    return;
  }
  if (event === "observer:closed") {
    for (const observer of room.observers) {
      if (observer.socketId) io.to(observer.socketId).emit("room:closed");
    }
    return;
  }
  for (const player of room.players) {
    if (!player.socketId) continue;
    if (event === "room:state") {
      io.to(player.socketId).emit("room:state", viewFor(room, player.id));
    } else {
      io.to(player.socketId).emit(event, payload);
    }
  }
  for (const observer of room.observers) {
    if (!observer.socketId) continue;
    if (event === "room:state") {
      io.to(observer.socketId).emit("room:state", viewFor(room, observer.id, true));
    } else {
      io.to(observer.socketId).emit(event, payload);
    }
  }
});

setLobbyBroadcast((publicRooms, adminRooms) => {
  for (const sock of io.sockets.sockets.values()) {
    sock.emit("lobby:rooms", sock.data.isAdmin ? adminRooms : publicRooms);
  }
});

function notifyReplaced(socketIds: string[] | undefined) {
  for (const id of socketIds ?? []) {
    io.to(id).emit("session:replaced");
  }
}

io.on("connection", async (socket) => {
  const session = await sessionFromHeaders(socket.handshake.headers);
  const userId = session?.user.id ?? null;
  socket.data.userId = userId;
  socket.data.userEmail = session?.user.email ?? null;
  socket.data.isAdmin = isAdminUser(session?.user);
  socket.emit("session:role", { admin: Boolean(socket.data.isAdmin) });
  socket.emit("lobby:rooms", lobbyRoomsFor(socket));

  if (userId) {
    const rejoined = rejoinByUserId(socket.id, userId);
    if (rejoined) {
      notifyReplaced(rejoined.replacedSocketIds);
      emitMembership(socket, rejoined.room, rejoined.playerId, rejoined.observing);
    }
  }

  socket.on("lobby:list", () => {
    socket.emit("lobby:rooms", lobbyRoomsFor(socket));
  });

  socket.on("room:create", ({ name, solo }: { name?: string; solo?: boolean }) => {
    try {
      const { room, playerId, replacedSocketIds } = createRoom(
        socket.id,
        name ?? "",
        Boolean(solo),
        userIdOf(socket),
      );
      notifyReplaced(replacedSocketIds);
      emitMembership(socket, room, playerId);
    } catch (err) {
      socket.emit("notice", { message: "Impossible de créer le salon" });
      console.error(err);
    }
  });

  socket.on("room:join", ({ code, name }: { code?: string; name?: string }) => {
    const result = joinRoom(socket.id, code ?? "", name ?? "", userIdOf(socket));
    if ("error" in result) {
      socket.emit("notice", { message: result.error });
      return;
    }
    notifyReplaced(result.replacedSocketIds);
    emitMembership(socket, result.room, result.playerId);
  });

  socket.on("room:observe", ({ code, name }: { code?: string; name?: string }) => {
    if (!isAdminOf(socket)) {
      socket.emit("notice", { message: "Action réservée aux administrateurs" });
      return;
    }
    const result = observeRoom(socket.id, code ?? "", name ?? "", userIdOf(socket));
    if ("error" in result) {
      socket.emit("notice", { message: result.error });
      return;
    }
    notifyReplaced(result.replacedSocketIds);
    emitMembership(socket, result.room, result.observerId, true);
  });

  socket.on(
    "room:rejoin",
    ({ code, playerId }: { code?: string; playerId?: string }) => {
      const result = rejoinRoom(socket.id, code ?? "", playerId ?? "", userIdOf(socket));
      if ("error" in result) {
        socket.emit("notice", { message: result.error });
        return;
      }
      notifyReplaced(result.replacedSocketIds);
      emitMembership(socket, result.room, result.playerId, result.observing);
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

  socket.on("game:trace", ({ cells }: { cells?: number[] }) => {
    setPlayerTrace(socket.id, cells ?? []);
  });

  socket.on("game:reroll", () => {
    const result = voteReroll(socket.id);
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("dict:add", ({ key }: { key?: string }) => {
    const result = adoptRejectedWord(socket.id, key ?? "");
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("chat:send", ({ text }: { text?: string }) => {
    const result = sendChat(socket.id, text ?? "");
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("chat:like", ({ key }: { key?: string }) => {
    const result = toggleWordLike(socket.id, key ?? "");
    if (result && "error" in result) socket.emit("notice", { message: result.error });
  });

  socket.on("room:leave", () => {
    leaveRoom(socket.id, userIdOf(socket));
  });

  socket.on("room:close", ({ code }: { code?: string }) => {
    if (!isAdminOf(socket)) {
      socket.emit("notice", { message: "Action réservée aux administrateurs" });
      return;
    }
    const result = closeRoom(code ?? "");
    if ("error" in result) {
      socket.emit("notice", { message: result.error });
      return;
    }
    const who = typeof socket.data.userEmail === "string" ? socket.data.userEmail : userIdOf(socket);
    console.log(`Admin ${who ?? "?"} closed room ${String(code ?? "").toUpperCase()}`);
    for (const id of result.socketIds) {
      io.to(id).emit("room:closed");
    }
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
migrateStore();
await migrateAuth();
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

function userIdOf(socket: { data: { userId?: unknown } }): string | null {
  return typeof socket.data.userId === "string" ? socket.data.userId : null;
}

function isAdminOf(socket: { data: { isAdmin?: unknown } }): boolean {
  return socket.data.isAdmin === true;
}

function lobbyRoomsFor(socket: { data: { isAdmin?: unknown } }) {
  return isAdminOf(socket) ? listAdminRooms() : listPublicRooms();
}

function emitMembership(
  socket: { emit: (event: string, payload: unknown) => void },
  room: Parameters<typeof viewFor>[0],
  viewerId: string,
  observing = false,
) {
  socket.emit("session", { playerId: viewerId, code: room.code, observing });
  socket.emit("room:state", viewFor(room, viewerId, observing));
}
