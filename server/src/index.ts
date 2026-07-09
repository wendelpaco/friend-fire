import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";

const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "friend-fire-server" });
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
