"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { HudSnapshot } from "@/game/types";
import { getOperatorById, getOperatorPrefs } from "@/domains/operator";
import { getMapById, setLastMapId } from "@/domains/world";
import {
  getColyseusRoomClient,
  type NetworkRoomState,
} from "@/infrastructure/realtime/roomClient";
import { MatchLoadingScreen } from "@/presentation/session/MatchLoadingScreen";
import { GameHud } from "./GameHud";

export type PlayMode = "local" | "room";

interface GameCanvasProps {
  mode?: PlayMode;
  roomCode?: string;
  /** Host may create-or-join; guests join existing rooms only. */
  isHost?: boolean;
  /**
   * Map registry id (query `?map=`). Chosen at entry — room map is fixed at
   * create navigation (no mid-session map reload). If net later reports a
   * different mapId, client does not hot-swap geometry (document: pick map
   * before /play via host create URL).
   */
  mapId?: string;
  /**
   * Squad/party id from `?party=` (Meta-3). Invitees share host party for
   * private squad chat. Host defaults to room code when omitted.
   */
  partyId?: string;
}

const INPUT_HZ = 20;
const INPUT_MS = 1000 / INPUT_HZ;

export function GameCanvas({
  mode = "local",
  roomCode,
  isHost = false,
  mapId,
  partyId,
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
  /** Engine constructed + started */
  const [engineReady, setEngineReady] = useState(false);
  /** Cinematic boot splash (min time + engine) */
  const [bootSplash, setBootSplash] = useState(true);
  const [net, setNet] = useState<NetworkRoomState | null>(null);

  const resolvedMapId = mapId || "dust";
  const mapDisplayName =
    getMapById(resolvedMapId)?.displayName ?? resolvedMapId;
  const operatorName = (() => {
    try {
      const prefs = getOperatorPrefs();
      return getOperatorById(prefs.operatorId)?.name ?? "Operador";
    } catch {
      return "Operador";
    }
  })();

  const onMatchContinue = useCallback(() => {
    void roomRef.current?.leave();
    roomRef.current = null;
    engineRef.current?.dispose();
    engineRef.current = null;
    router.push("/");
  }, [router]);

  const onDismissShowcase = useCallback((opts: { openBuy: boolean }) => {
    engineRef.current?.dismissShopShowcase(opts);
  }, []);

  const onBootSplashFinished = useCallback(() => {
    setBootSplash(false);
  }, []);

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

        setLastMapId(resolvedMapId);

        const engine = new GameClient(canvas, resolvedMapId);
        engineRef.current = engine;
        // Engine already throttles (~12 Hz + immediate combat). Transition
        // keeps the canvas rAF smooth if React is busy painting HUD.
        engine.setHudListener((snapshot) => {
          if (
            snapshot.hitMarker ||
            snapshot.damageFlash > 0.02 ||
            snapshot.roundBanner ||
            snapshot.paused ||
            snapshot.showBuyMenu ||
            snapshot.showShopShowcase ||
            snapshot.showHelp
          ) {
            setHud(snapshot);
          } else {
            startTransition(() => setHud(snapshot));
          }
        });

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
        setEngineReady(true);

        return () => window.removeEventListener("resize", resize);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Falha ao iniciar o jogo");
        setEngineReady(true);
        setBootSplash(false);
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
  }, [mapId, resolvedMapId]);

  // Colyseus session when mode=room (reuse lobby singleton seat when present).
  // IMPORTANT: do not leave() on every effect cleanup — React Strict Mode
  // remounts would tear down a healthy socket and race the next connect
  // (browser surfaces that as ProgressEvent / "servidor indisponível").
  useEffect(() => {
    if (mode !== "room" || !roomCode) {
      setNet(null);
      void getColyseusRoomClient().leave();
      return;
    }

    let cancelled = false;
    const client = getColyseusRoomClient();
    roomRef.current = client;

    /** Throttle React net chrome (~10 Hz); engine always gets full ticks (W4). */
    let lastNetUiAt = 0;
    let lastNetUiPhase = "";
    let lastNetUiMode = "";
    let lastNetUiError: string | null = null;

    const unsub = client.onState((state) => {
      if (cancelled) return;
      const snap = state as NetworkRoomState;
      const engine = engineRef.current;
      if (engine) {
        if (snap.connected && !snap.hybridLocalCombat) {
          engine.setNetworked(true, snap.sessionId);
          engine.setBuySender((itemId) => client.sendBuy(itemId));
          engine.setChatSender((channel, text) =>
            client.sendChat(channel, text),
          );
          // Pass players by reference — no per-tick map clone
          engine.applyNetworkState({
            sessionId: snap.sessionId,
            players: snap.players,
            phase: snap.phase,
            round: snap.round,
            scoreTR: snap.scoreTR,
            scoreCT: snap.scoreCT,
            timeLeft: snap.timeLeft,
            bombState: snap.bombState,
            bombX: snap.bombX,
            bombZ: snap.bombZ,
            bombTimer: snap.bombTimer,
            bombCarrierId: snap.bombCarrierId,
            plantProgress: snap.plantProgress,
            defuseProgress: snap.defuseProgress,
            roundEndReason: snap.roundEndReason,
            weaponDrops: snap.weaponDrops,
          });
        } else if (!snap.connected) {
          engine.setNetworked(false, null);
          engine.setBuySender(null);
          engine.setChatSender(null);
        } else {
          engine.setBuySender(null);
          engine.setChatSender(null);
        }
      }

      const now = performance.now();
      const uiCritical =
        snap.phase !== lastNetUiPhase ||
        snap.mode !== lastNetUiMode ||
        snap.error !== lastNetUiError ||
        !snap.connected;
      if (uiCritical || now - lastNetUiAt >= 100) {
        lastNetUiAt = now;
        lastNetUiPhase = snap.phase ?? "";
        lastNetUiMode = snap.mode;
        lastNetUiError = snap.error;
        if (uiCritical) setNet(snap);
        else startTransition(() => setNet(snap));
      }
    });

    const unsubHe =
      typeof client.onHeFx === "function"
        ? client.onHeFx((event) => {
            if (cancelled) return;
            engineRef.current?.applyNetworkHeFx(event);
          })
        : () => {};

    const unsubShot =
      typeof client.onShotFx === "function"
        ? client.onShotFx((event) => {
            if (cancelled) return;
            engineRef.current?.applyNetworkShotFx(event);
          })
        : () => {};

    const unsubChat =
      typeof client.onChat === "function"
        ? client.onChat((event) => {
            if (cancelled) return;
            engineRef.current?.appendNetworkChat({
              id: event.id,
              channel: event.channel,
              fromName: event.fromName,
              text: event.text,
              at: event.at,
            });
          })
        : () => {};

    const connect = async () => {
      const opts = {
        host: isHost,
        mapId: mapId || "dust",
        party: partyId,
      };
      // Retry: first attempt often races Strict Mode remount / server warm-up.
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          await client.connect(roomCode, opts);
          if (!cancelled) setNet(client.snapshot());
          return;
        } catch (e) {
          lastErr = e;
          if (cancelled) return;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          }
        }
      }
      if (!cancelled) {
        setNet(client.snapshot());
        engineRef.current?.setNetworked(false, null);
        engineRef.current?.setBuySender(null);
        engineRef.current?.setChatSender(null);
        console.warn("[room] Colyseus connect failed:", lastErr);
      }
    };
    void connect();

    const inputTimer = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine || !client.isConnected()) return;
      // Don't shoot / move-wire while typing in chat (Meta-3 focus trap).
      // If mouse is already down on the canvas, force-clear the trap so a
      // stuck death-social chat focus cannot permanently zero `fire`.
      if (engine.isChatFocused() || engine.input.isTypingTarget()) {
        if (engine.input.isMouseDown(0)) {
          engine.setChatFocused(false);
        } else {
          client.sendInput({
            dx: 0,
            dz: 0,
            aimX: engine.input.aimWorldX,
            aimZ: engine.input.aimWorldZ,
            fire: false,
            reload: false,
            slot: 0,
            plant: false,
            he: false,
            jump: false,
          });
          return;
        }
      }
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
        plant: engine.input.isDown("KeyF"),
        he: engine.input.isDown("KeyG"),
        jump: engine.input.isDown("Space"),
        pickup: engine.input.isDown("KeyE"),
      });
    }, INPUT_MS);

    return () => {
      cancelled = true;
      unsub();
      unsubHe();
      unsubShot();
      unsubChat();
      window.clearInterval(inputTimer);
      engineRef.current?.setNetworked(false, null);
      engineRef.current?.setBuySender(null);
      engineRef.current?.setChatSender(null);
      // Keep Colyseus seat alive across Strict remounts; leave on page exit.
    };
  }, [mode, roomCode, isHost, mapId, partyId]);

  // Leave multiplayer only when leaving the play canvas entirely.
  useEffect(() => {
    return () => {
      void getColyseusRoomClient().leave();
      roomRef.current = null;
    };
  }, []);

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
              : `Online · combate no servidor · loja no servidor · ${net.players.filter((p) => !p.isBot).length} humano(s)`
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
        onMouseDown={() => {
          // Clicking the arena clears stuck chat focus so fire always works.
          engineRef.current?.setChatFocused(false);
          canvasRef.current?.focus({ preventScroll: true });
        }}
      />
      {bootSplash && (
        <MatchLoadingScreen
          mapName={mapDisplayName}
          operatorName={operatorName}
          roomCode={mode === "room" ? displayCode : undefined}
          engineReady={engineReady}
          minMs={mode === "room" ? 3200 : 2600}
          onFinished={onBootSplashFinished}
        />
      )}
      {hud && !bootSplash && (
        <GameHud
          hud={hud}
          roomCode={mode === "room" ? displayCode : undefined}
          onResume={() => engineRef.current?.setPaused(false)}
          onDismissHelp={() => engineRef.current?.dismissHelp()}
          onOpenHelp={() => engineRef.current?.openHelp()}
          onMatchContinue={onMatchContinue}
          onBuy={(id) => engineRef.current?.purchase(id)}
          onCloseBuy={() => engineRef.current?.closeBuyMenu()}
          onDismissShowcase={onDismissShowcase}
          onSendChat={(channel, text) =>
            engineRef.current?.sendChat(channel, text)
          }
          onChatFocusChange={(focused) =>
            engineRef.current?.setChatFocused(focused)
          }
        />
      )}
      {mode === "room" && displayCode && !hud && !bootSplash && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-black/70 px-4 py-1.5 font-mono text-sm font-bold tracking-[0.3em] text-amber-200 shadow-lg backdrop-blur-md">
          SALA {displayCode}
        </div>
      )}
      {netBanner && !bootSplash && (
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
