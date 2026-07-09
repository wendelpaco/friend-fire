import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";

const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "friend-fire-server" });
});

/** Server browser: live game rooms with map/code metadata */
app.get("/rooms", async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: "game" });
    const list = rooms.map((room) => {
      const meta = (room.metadata ?? {}) as {
        code?: string;
        mapId?: string;
        mapName?: string;
        roomName?: string;
        phase?: string;
      };
      return {
        roomId: room.roomId,
        code: meta.code ?? "",
        mapId: meta.mapId ?? "dust",
        mapName: meta.mapName ?? "Dust FF",
        roomName: meta.roomName ?? "",
        clients: room.clients,
        maxClients: room.maxClients,
        phase: meta.phase,
      };
    });
    res.json(list);
  } catch (err) {
    console.error("[/rooms]", err);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// Private matches: join/create filtered by room code option/metadata.
gameServer.define("game", GameRoom).filterBy(["code"]);

gameServer.listen(PORT).then(() => {
  console.log(`Listening on ws://localhost:${PORT}`);
});
