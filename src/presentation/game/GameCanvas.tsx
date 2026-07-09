"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HudSnapshot } from "@/game/types";
import {
  getColyseusRoomClient,
  type NetworkRoomState,
} from "@/infrastructure/realtime/roomClient";
import { GameHud } from "./GameHud";

export type PlayMode = "local" | "room";

interface GameCanvasProps {
  mode?: PlayMode;
  roomCode?: string;
  /** Host may create-or-join; guests join existing rooms only. */
  isHost?: boolean;
}

const INPUT_HZ = 20;
const INPUT_MS = 1000 / INPUT_HZ;

export function GameCanvas({
  mode = "local",
  roomCode,
  isHost = false,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<import("@/infrastructure/render/GameClient").GameClient | null>(
    null,
  );
  const roomRef = useRef<ReturnType<typeof getColyseusRoomClient> | null>(null);
  const router = useRouter();
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [net, setNet] = useState<NetworkRoomState | null>(null);

  const onMatchContinue = useCallback(() => {
    void roomRef.current?.leave();
    roomRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    router.push("/");
  }, [router]);

  // Boot local engine (always — hybrid combat even in room mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let disposed = false;

    const boot = async () => {
      try {
        const { GameClient } = await import(
          "@/infrastructure/render/GameClient"
        );
        if (disposed) return;

        const engine = new GameClient(canvas);
        engineRef.current = engine;
        engine.setHudListener((snapshot) => setHud(snapshot));

        const resize = () => {
          if (!engineRef.current || !container) return;
          engineRef.current.resize(
            container.clientWidth,
            container.clientHeight,
          );
        };
        resize();
        window.addEventListener("resize", resize);
        engine.start();
        setLoading(false);

        return () => window.removeEventListener("resize", resize);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Falha ao iniciar o jogo");
        setLoading(false);
      }
    };

    let cleanupResize: (() => void) | undefined;
    boot().then((fn) => {
      cleanupResize = fn;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Colyseus session when mode=room (reuse lobby singleton seat when present)
  useEffect(() => {
    if (mode !== "room" || !roomCode) {
      setNet(null);
      return;
    }

    let cancelled = false;
    // Singleton: host create() / guest join() may already hold the seat.
    const client = getColyseusRoomClient();
    roomRef.current = client;

    const unsub = client.onState((state) => {
      if (cancelled) return;
      const snap = state as NetworkRoomState;
      setNet(snap);
      const engine = engineRef.current;
      if (!engine) return;
      if (snap.connected && !snap.hybridLocalCombat) {
        engine.setNetworked(true, snap.sessionId);
        engine.applyNetworkState({
          sessionId: snap.sessionId,
          players: snap.players,
          phase: snap.phase,
          round: snap.round,
          scoreTR: snap.scoreTR,
          scoreCT: snap.scoreCT,
          timeLeft: snap.timeLeft,
        });
      } else if (!snap.connected) {
        engine.setNetworked(false, null);
      }
    });

    const connect = async () => {
      try {
        await client.connect(roomCode, { host: isHost });
      } catch (e) {
        if (!cancelled) {
          setNet(client.snapshot());
          engineRef.current?.setNetworked(false, null);
          console.warn("[room] Colyseus connect failed:", e);
        }
      }
    };
    void connect();

    const inputTimer = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine || !client.isConnected()) return;
      const move = engine.input.moveVector();
      const slot = engine.input.weaponSlotKey() ?? 0;
      client.sendInput({
        dx: move.x,
        dz: move.z,
        aimX: engine.input.aimWorldX,
        aimZ: engine.input.aimWorldZ,
        fire: engine.input.isMouseDown(0),
        reload: engine.input.isDown("KeyR"),
        slot,
      });
    }, INPUT_MS);

    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(inputTimer);
      engineRef.current?.setNetworked(false, null);
      void client.leave();
      if (roomRef.current === client) roomRef.current = null;
    };
  }, [mode, roomCode, isHost]);

  const displayCode =
    (net?.code && net.code.length > 0 ? net.code : roomCode) ?? undefined;

  const netBanner =
    mode === "room"
      ? net?.mode === "connecting"
        ? "Conectando ao servidor…"
        : net?.mode === "error" || (net && !net.connected && net.error)
          ? net.error || "Servidor multiplayer indisponível"
          : net?.connected
            ? net.hybridLocalCombat
              ? `Online · ${net.players.filter((p) => !p.isBot).length} humano(s) · híbrido local`
              : `Online · combate no servidor · ${net.players.filter((p) => !p.isBot).length} humano(s)`
            : roomCode
              ? "Conectando ao servidor…"
              : null
      : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0a0c10]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair"
        tabIndex={0}
      />
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0a0c10]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
          <p className="text-sm tracking-wide text-white/50">
            Carregando arena…
          </p>
        </div>
      )}
      {hud && (
        <GameHud
          hud={hud}
          roomCode={mode === "room" ? displayCode : undefined}
          onResume={() => engineRef.current?.setPaused(false)}
          onDismissHelp={() => engineRef.current?.dismissHelp()}
          onOpenHelp={() => engineRef.current?.openHelp()}
          onMatchContinue={onMatchContinue}
          onBuy={(id) => engineRef.current?.purchase(id)}
          onCloseBuy={() => engineRef.current?.closeBuyMenu()}
        />
      )}
      {mode === "room" && displayCode && !hud && !loading && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-black/70 px-4 py-1.5 font-mono text-sm font-bold tracking-[0.3em] text-amber-200 shadow-lg backdrop-blur-md">
          SALA {displayCode}
        </div>
      )}
      {netBanner && !loading && (
        <div
          className={`pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-[11px] shadow-lg backdrop-blur-md ${
            net?.mode === "error" || (net && !net.connected && net.error)
              ? "border-red-400/40 bg-red-950/80 text-red-100"
              : net?.connected
                ? "border-emerald-400/35 bg-black/70 text-emerald-100/90"
                : "border-white/15 bg-black/70 text-white/70"
          }`}
        >
          {netBanner}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
