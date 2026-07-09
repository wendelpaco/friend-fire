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

/**
 * Server browser: live game rooms with map/code/region metadata.
 * Query: mapId, hasSlots=1, visibility (default public), region=BR|US
 */
app.get("/rooms", async (req, res) => {
  try {
    const visibilityRaw =
      typeof req.query.visibility === "string" ? req.query.visibility : "public";
    const visibility = visibilityRaw === "private" ? "private" : "public";
    const mapId =
      typeof req.query.mapId === "string" && req.query.mapId
        ? req.query.mapId
        : undefined;
    const hasSlots =
      req.query.hasSlots === "1" || req.query.hasSlots === "true";
    const regionRaw =
      typeof req.query.region === "string" ? req.query.region.toUpperCase() : "";
    const region =
      regionRaw === "BR" || regionRaw === "US" ? regionRaw : undefined;

    const rooms = await matchMaker.query({ name: "game" });
    let list = rooms.map((room) => {
      const meta = (room.metadata ?? {}) as {
        code?: string;
        mapId?: string;
        mapName?: string;
        roomName?: string;
        phase?: string;
        visibility?: string;
        region?: string;
      };
      const roomVisibility =
        meta.visibility === "private" ? "private" : "public";
      const roomRegion = meta.region === "US" ? "US" : "BR";
      return {
        roomId: room.roomId,
        code: meta.code ?? "",
        mapId: meta.mapId ?? "dust",
        mapName: meta.mapName ?? "Dust FF",
        roomName: meta.roomName ?? "",
        clients: room.clients,
        maxClients: room.maxClients,
        phase: meta.phase,
        visibility: roomVisibility,
        region: roomRegion,
      };
    });

    list = list.filter((r) => r.visibility === visibility);
    if (mapId) {
      list = list.filter((r) => r.mapId === mapId);
    }
    if (region) {
      list = list.filter((r) => r.region === region);
    }
    if (hasSlots) {
      list = list.filter((r) => r.clients < r.maxClients);
    }

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
