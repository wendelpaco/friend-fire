"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdBanner } from "@/presentation/ads/AdBanner";
import { GAME_NAME, GAME_TAGLINE } from "@/game/constants";
import {
  formatMissionProgress,
  getMissionsWithProgress,
  getXp,
  progressInTier,
  setRegion as persistIdentityRegion,
  xpToTier,
  type DailyMission,
} from "@/domains/identity";
import { operatorSelectHref } from "@/domains/operator";
import {
  getGraphicsQuality,
  setGraphicsQuality,
  type GraphicsQuality,
} from "@/domains/prefs";
import {
  extractRoomCodeFromText,
  isValidRoomCode,
  normalizeRoomCode,
  parseSalaQuery,
} from "@/domains/session";
import {
  getLastMapId,
  listMaps,
  setLastMapId,
  type MapId,
} from "@/domains/world";
import { measurePing } from "@/infrastructure/realtime/ping";
import {
  clearLastRoom,
  getLastRoom,
  getRoomClient,
  type LastRoom,
} from "@/infrastructure/realtime/roomClient";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";
import { LeaderboardPanel } from "@/presentation/lobby/LeaderboardPanel";
import {
  RoomPanel,
  type RoomPanelMode,
} from "@/presentation/lobby/RoomPanel";
import { ServerBrowser } from "@/presentation/lobby/ServerBrowser";

/**
 * Read localStorage only after mount. Never call from useState initializers —
 * SSR has no storage, client does → hydration text mismatch (e.g. OP vs PA).
 */
function readStorage<T>(key: string, fallback: T, parse?: (v: string) => T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return parse ? parse(raw) : (raw as T);
  } catch {
    return fallback;
  }
}

const DEFAULT_NICKNAME = "Operador";
const DEFAULT_REGION: "BR" | "US" = "BR";
const DEFAULT_VOLUME = 70;
const PING_INTERVAL_MS = 8000;
const PRESENCE_INTERVAL_MS = 15000;
/** Client-side join debounce (G3) — avoid spam on double-click. */
const JOIN_DEBOUNCE_MS = 700;

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string }[] = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
];

export function MainMenu() {
  const router = useRouter();
  // Fixed defaults for SSR + first client paint (must match).
  const [region, setRegion] = useState<"BR" | "US">(DEFAULT_REGION);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [nickname, setNickname] = useState(DEFAULT_NICKNAME);
  const [editingName, setEditingName] = useState(false);
  const [roomPanel, setRoomPanel] = useState<RoomPanelMode | null>(null);
  const [serverBrowserOpen, setServerBrowserOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [lastMap, setLastMap] = useState("dust");
  const [quickMatchBusy, setQuickMatchBusy] = useState(false);
  const [quickMatchError, setQuickMatchError] = useState<string | null>(null);
  /** Bumped on cancel / new search so stale results leave and do not navigate. */
  const quickMatchGen = useRef(0);
  const [lastRoom, setLastRoomState] = useState<LastRoom | null>(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);

  // —— Room code hero ——
  const [codeInput, setCodeInput] = useState("");
  const [codeHighlight, setCodeHighlight] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const lastJoinAt = useRef(0);
  const deepLinkApplied = useRef(false);

  // —— Region ping / presence / quality ——
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [playersOnline, setPlayersOnline] = useState<number | null>(null);
  const [presenceOk, setPresenceOk] = useState(false);
  const [quality, setQuality] = useState<GraphicsQuality>("medium");

  // Hydrate prefs from localStorage after mount (client-only).
  useEffect(() => {
    setNickname(readStorage("ff_nickname", DEFAULT_NICKNAME));
    setRegion(
      readStorage("ff_region", DEFAULT_REGION, (v) =>
        v === "BR" || v === "US" ? v : DEFAULT_REGION,
      ),
    );
    setVolume(
      readStorage("ff_volume", DEFAULT_VOLUME, (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : DEFAULT_VOLUME;
      }),
    );
    setMissions(getMissionsWithProgress());
    setXpTotal(getXp());
    setLastMap(getLastMapId("dust"));
    setLastRoomState(getLastRoom());
    setQuality(getGraphicsQuality());
  }, []);

  // Deep link ?sala=CODE (or ?code=) + optional clipboard auto-paste of valid code.
  useEffect(() => {
    if (deepLinkApplied.current) return;
    deepLinkApplied.current = true;

    const fromQuery = parseSalaQuery(window.location.search);
    if (fromQuery) {
      setCodeInput(fromQuery);
      setCodeHighlight(true);
      window.setTimeout(() => setCodeHighlight(false), 1200);
      // Focus after paint so the hero input is ready.
      window.requestAnimationFrame(() => codeInputRef.current?.focus());
      return;
    }

    // Soft clipboard paste — only when field empty and content is a valid code.
    const tryClip = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        const code = extractRoomCodeFromText(text);
        if (!code) return;
        setCodeInput((prev) => (prev.trim() ? prev : code));
      } catch {
        /* permission denied or unavailable — ignore */
      }
    };
    void tryClip();
    window.requestAnimationFrame(() => codeInputRef.current?.focus());
  }, []);

  // Live ping (periodic).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const ms = await measurePing();
      if (!alive) return;
      setPingMs(ms);
    };
    void tick();
    const id = window.setInterval(() => void tick(), PING_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // Real presence via room listing — never invent a static number.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const list = await getRoomClient().listRooms({ visibility: "public" });
        if (!alive) return;
        if (!Array.isArray(list)) {
          setPresenceOk(false);
          setPlayersOnline(null);
          return;
        }
        const total = list.reduce(
          (sum, r) => sum + (Number.isFinite(r.clients) ? r.clients : 0),
          0,
        );
        setPlayersOnline(total);
        setPresenceOk(true);
      } catch {
        if (!alive) return;
        setPresenceOk(false);
        setPlayersOnline(null);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), PRESENCE_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  /** Path B: always visit operator select before /play (re-pick allowed). */
  const playUrl = `/play?mode=local&map=${encodeURIComponent(lastMap || "dust")}`;
  const quickPlayHref = operatorSelectHref(playUrl);
  const rank = xpToTier(xpTotal);
  const rankProgress = progressInTier(xpTotal);
  const lobbyMaps = listMaps();
  const codeNormalized = normalizeRoomCode(codeInput);
  const codeValid = isValidRoomCode(codeNormalized);

  const selectLobbyMap = (id: string) => {
    const mapId = (id === "favela" || id === "yard" || id === "dust"
      ? id
      : "dust") as MapId;
    setLastMapId(mapId);
    setLastMap(mapId);
  };

  const goToRoom = useCallback(
    (code: string, host = false, roomMapId?: string) => {
      const qs = new URLSearchParams({
        mode: "room",
        code,
      });
      if (host) qs.set("host", "1");
      const map =
        roomMapId || getLastMapId("dust") || lastMap || "dust";
      qs.set("map", map);
      setLastMapId(map);
      setLastMap(map);
      router.push(operatorSelectHref(`/play?${qs.toString()}`));
    },
    [lastMap, router],
  );

  const handleJoinByCode = async () => {
    setJoinError(null);
    const code = normalizeRoomCode(codeInput);
    if (!isValidRoomCode(code)) {
      setJoinError("Código inválido. Use 6 caracteres (A–Z, 2–9, sem O/0/I/1).");
      return;
    }
    const now = Date.now();
    if (now - lastJoinAt.current < JOIN_DEBOUNCE_MS || joinBusy) return;
    lastJoinAt.current = now;
    setJoinBusy(true);
    try {
      const client = getRoomClient();
      await client.join(code);
      const snap = client.snapshot();
      goToRoom(code, false, snap.mapId || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao entrar na sala";
      setJoinError(msg.includes("Sala não existe") ? "Sala não existe" : msg);
    } finally {
      setJoinBusy(false);
    }
  };

  const cancelQuickMatch = () => {
    quickMatchGen.current += 1;
    setQuickMatchBusy(false);
  };

  /** Spec §2.6 — rejoin last multiplayer room by stored code. */
  const handleRejoinLastRoom = async () => {
    const stored = getLastRoom();
    if (!stored?.code) {
      setLastRoomState(null);
      return;
    }
    setRejoinError(null);
    setRejoinBusy(true);
    try {
      const client = getRoomClient();
      await client.join(stored.code);
      const snap = client.snapshot();
      const map =
        snap.mapId || stored.mapId || getLastMapId("dust") || "dust";
      setLastMapId(map);
      setLastMap(map);
      const qs = new URLSearchParams({
        mode: "room",
        code: stored.code,
        map,
      });
      router.push(operatorSelectHref(`/play?${qs.toString()}`));
    } catch (e) {
      clearLastRoom();
      setLastRoomState(null);
      const msg =
        e instanceof Error ? e.message : "Falha ao reentrar na última sala";
      setRejoinError(msg);
    } finally {
      setRejoinBusy(false);
    }
  };

  const handleQuickMatchOnline = async () => {
    const gen = ++quickMatchGen.current;
    setQuickMatchError(null);
    setQuickMatchBusy(true);
    const minDisplay = new Promise<void>((r) => setTimeout(r, 500));
    const client = getRoomClient();
    try {
      const mapId = lastMap || getLastMapId("dust") || "dust";
      const [result] = await Promise.all([
        client.quickMatch({ mapId }),
        minDisplay,
      ]);
      const { code, host } = result;
      if (gen !== quickMatchGen.current) {
        if (client.getCode() === code) await client.leave();
        return;
      }
      const snap = client.snapshot();
      const map = snap.mapId || mapId;
      setLastMapId(map);
      setLastMap(map);
      const qs = new URLSearchParams({
        mode: "room",
        code,
        map,
      });
      if (host) qs.set("host", "1");
      router.push(operatorSelectHref(`/play?${qs.toString()}`));
    } catch (e) {
      if (gen !== quickMatchGen.current) return;
      const msg =
        e instanceof Error
          ? e.message
          : "Servidor multiplayer indisponível.";
      setQuickMatchError(
        msg.includes("Failed to list") ||
          msg.includes("fetch") ||
          msg.includes("indisponível")
          ? "Servidor multiplayer indisponível. Rode `npm run dev:server` e tente de novo."
          : msg,
      );
    } finally {
      if (gen === quickMatchGen.current) setQuickMatchBusy(false);
    }
  };

  const saveNickname = (name: string) => {
    const clean = name.trim().slice(0, 16) || "Operador";
    setNickname(clean);
    setEditingName(false);
    try {
      localStorage.setItem("ff_nickname", clean);
    } catch {
      /* ignore */
    }
  };

  const setRegionPersist = (r: "BR" | "US") => {
    setRegion(r);
    persistIdentityRegion(r);
    try {
      localStorage.setItem("ff_region", r);
    } catch {
      /* ignore */
    }
  };

  const setQualityPersist = (q: GraphicsQuality) => {
    setQuality(q);
    setGraphicsQuality(q);
  };

  const pingLabel =
    pingMs != null ? `${pingMs}ms` : "—";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090e] text-white scanlines">
      {/* cinematic bg — poster energy (RUSH-B-inspired, original geometry) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,#3b1a08_0%,transparent_50%),radial-gradient(ellipse_at_15%_85%,#0a1628_0%,transparent_45%),linear-gradient(180deg,#12151c_0%,#07090e_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-950/40 to-transparent" />
        <div className="absolute inset-0 overflow-hidden motion-safe:opacity-100" aria-hidden>
          <div className="absolute left-[15%] top-[20%] h-1 w-1 rounded-full bg-amber-400/30 motion-safe:animate-[float_8s_ease-in-out_infinite]" />
          <div className="absolute left-[35%] top-[45%] h-1.5 w-1.5 rounded-full bg-orange-400/20 motion-safe:animate-[float_10s_ease-in-out_infinite_2s]" />
          <div className="absolute left-[60%] top-[30%] h-1 w-1 rounded-full bg-amber-300/25 motion-safe:animate-[float_9s_ease-in-out_infinite_4s]" />
          <div className="absolute left-[78%] top-[55%] h-0.5 w-0.5 rounded-full bg-yellow-400/30 motion-safe:animate-[float_7s_ease-in-out_infinite_1s]" />
          <div className="absolute left-[22%] top-[65%] h-1 w-1 rounded-full bg-amber-400/20 motion-safe:animate-[float_11s_ease-in-out_infinite_3s]" />
        </div>
        <div className="absolute bottom-0 right-[3%] hidden h-[82%] w-[min(44vw,440px)] opacity-[0.18] lg:block motion-safe:animate-ff-fade-in">
          <div className="absolute bottom-[15%] left-1/2 h-[40%] w-[34%] -translate-x-1/2 rounded-t-[35%] bg-gradient-to-b from-amber-700/70 via-amber-800/50 to-stone-900" />
          <div className="absolute bottom-[30%] left-1/2 h-[2%] w-[36%] -translate-x-1/2 bg-amber-600/50" />
          <div className="absolute bottom-[38%] left-1/2 h-[2%] w-[32%] -translate-x-1/2 bg-amber-600/40" />
          <div className="absolute bottom-[48%] left-1/2 h-[13%] w-[20%] -translate-x-1/2 rounded-t-[45%] bg-gradient-to-b from-amber-700/90 to-amber-800/70" />
          <div className="absolute bottom-[51%] left-1/2 h-[5%] w-[10%] -translate-x-1/2 rounded-sm bg-stone-950/80" />
          <div className="absolute bottom-[42%] left-[64%] h-[8%] w-[52%] origin-left -rotate-[6deg] rounded-sm bg-gradient-to-r from-stone-700 to-stone-500" />
          <div className="absolute bottom-[44%] left-[85%] h-[3%] w-[18%] origin-left -rotate-[6deg] rounded-r-sm bg-stone-400/80" />
          <div className="absolute bottom-[38%] left-[10%] h-[8%] w-[20%] origin-right rotate-[15deg] rounded-sm bg-stone-700/70" />
          <div className="absolute bottom-0 left-[28%] h-[20%] w-[13%] rounded-t-md bg-gradient-to-b from-stone-800 to-stone-950" />
          <div className="absolute bottom-0 left-[26%] h-[5%] w-[16%] rounded-sm bg-stone-950" />
          <div className="absolute bottom-0 right-[28%] h-[20%] w-[13%] rounded-t-md bg-gradient-to-b from-stone-800 to-stone-950" />
          <div className="absolute bottom-0 right-[26%] h-[5%] w-[16%] rounded-sm bg-stone-950" />
          <div className="absolute bottom-[28%] left-[22%] h-[12%] w-[16%] rounded-md bg-stone-800/60" />
        </div>
        <div className="absolute right-[14%] top-[36%] hidden h-28 w-28 rounded-full bg-orange-400/15 blur-2xl lg:block motion-safe:animate-ff-pulse-glow" />
      </div>

      {/* top sponsor strip */}
      <div className="relative z-20 border-b border-white/5 bg-black/40 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30 sm:block">
            Rede de parceiros
          </span>
          <div className="min-w-0 flex-1">
            <AdBanner
              placement="lobby_banner"
              compact
              className="max-h-14"
              rotateMs={7000}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl gap-10 px-5 py-8 motion-safe:animate-ff-fade-in lg:grid-cols-[1fr_340px] lg:items-start lg:px-10 lg:pt-12">
        {/* Left: logo + room hero + nav */}
        <div className="max-w-md">
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-semibold tracking-[0.35em] text-amber-500/80">
              ONLINE · BROWSER
            </p>
            <h1 className="text-5xl font-black leading-none tracking-tight md:text-6xl">
              <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                Friend
              </span>
              <span className="text-white"> Fire</span>
            </h1>
            <p className="mt-3 text-xs font-medium tracking-[0.28em] text-white/40">
              {GAME_TAGLINE}
            </p>
          </div>

          {/* Region chip + honest presence */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRegionModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-semibold tabular-nums text-white/85 backdrop-blur-sm transition hover:border-amber-400/40 hover:bg-black/70"
              title="Escolher região"
            >
              <span className="text-amber-200/90">{region}</span>
              <span className="text-white/25">·</span>
              <span
                className={
                  pingMs != null && pingMs < 80
                    ? "text-emerald-300/90"
                    : pingMs != null && pingMs < 160
                      ? "text-amber-300/90"
                      : "text-white/50"
                }
              >
                {pingLabel}
              </span>
            </button>
            {presenceOk && playersOnline != null ? (
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] tabular-nums text-white/50">
                {playersOnline === 0
                  ? "Sala privada · bots preenchem"
                  : `${playersOnline} jogando agora`}
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-white/40">
                Sala privada · bots preenchem
              </span>
            )}
          </div>

          {/* —— HERO: room code —— */}
          <div className="mb-4 rounded-2xl border border-amber-400/25 bg-black/50 p-4 shadow-[0_0_40px_rgba(245,158,11,0.08)] backdrop-blur-md">
            <label
              htmlFor="lobby-room-code"
              className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-500/80"
            >
              Código da sala
            </label>
            <input
              ref={codeInputRef}
              id="lobby-room-code"
              autoFocus
              value={codeInput}
              maxLength={8}
              spellCheck={false}
              autoComplete="off"
              placeholder="ABC234"
              aria-label="Código da sala"
              onChange={(e) => {
                setCodeInput(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                );
                setJoinError(null);
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                const extracted = extractRoomCodeFromText(text);
                if (extracted) {
                  e.preventDefault();
                  setCodeInput(extracted);
                  setJoinError(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleJoinByCode();
              }}
              className={`mt-2 w-full rounded-xl border bg-black/60 px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.35em] text-amber-100 outline-none placeholder:text-white/20 focus:border-amber-400/70 ${
                codeHighlight
                  ? "border-amber-400/80 motion-safe:animate-ff-flash-amber ring-2 ring-amber-400/40"
                  : "border-white/15"
              }`}
            />
            <p className="mt-2 text-center text-[11px] text-white/35">
              6 caracteres · sem O, 0, I ou 1 · cola automática se o clipboard for código
            </p>

            {joinError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              >
                {joinError}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setRoomPanel("create")}
                className="motion-safe:animate-ff-pulse-glow rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3.5 text-center text-sm font-black tracking-[0.2em] text-black shadow-lg shadow-amber-900/35 transition hover:from-amber-500 hover:to-amber-400 active:scale-[0.98]"
              >
                CRIAR SALA
              </button>
              <button
                type="button"
                disabled={joinBusy || codeInput.length === 0}
                onClick={() => void handleJoinByCode()}
                className="rounded-xl border border-white/15 bg-black/45 px-5 py-3.5 text-center text-sm font-semibold tracking-[0.18em] text-white/85 transition hover:border-amber-400/35 hover:bg-black/60 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {joinBusy ? "Entrando…" : "ENTRAR"}
              </button>
              {codeValid ? (
                <CopyInviteLink
                  code={codeNormalized}
                  host={false}
                  mapId={lastMap || "dust"}
                  label="COPIAR CONVITE"
                />
              ) : (
                <button
                  type="button"
                  disabled
                  title="Informe um código válido para copiar o convite"
                  className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold tracking-wide text-white/35 disabled:cursor-not-allowed"
                >
                  COPIAR CONVITE
                </button>
              )}
            </div>
          </div>

          {/* profile card */}
          <div className="mb-4 rounded-xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-700 text-sm font-black text-black shadow-lg shadow-orange-900/40">
                {nickname.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <input
                    autoFocus
                    defaultValue={nickname}
                    maxLength={16}
                    onBlur={(e) => saveNickname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        saveNickname((e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="w-full rounded border border-amber-500/40 bg-black/60 px-2 py-1 text-sm outline-none focus:border-amber-400"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="w-full text-left"
                  >
                    <div className="truncate font-semibold text-amber-100">
                      {nickname}
                    </div>
                    <div className="text-[11px] text-white/40">
                      <span className="font-semibold text-amber-200/90">
                        {rank.name}
                      </span>
                      {" · "}
                      {xpTotal.toLocaleString("pt-BR")} XP
                      {" · clique para editar"}
                    </div>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] tabular-nums text-white/35">
                <span>{rank.name}</span>
                <span>
                  {rank.nextXp != null
                    ? `${xpTotal.toLocaleString("pt-BR")} / ${rank.nextXp.toLocaleString("pt-BR")}`
                    : "MAX"}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(rankProgress * 100)}
                aria-label={`Progresso rank ${rank.name}`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-300"
                  style={{ width: `${Math.round(rankProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* map cards */}
          <div className="mb-4">
            <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Mapa
            </p>
            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              role="listbox"
              aria-label="Selecionar mapa"
            >
              {lobbyMaps.map((m) => {
                const selected = lastMap === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectLobbyMap(m.id)}
                    className={`relative min-h-[5.25rem] overflow-hidden rounded-xl border p-3 text-left motion-safe:transition-all motion-safe:duration-150 ${
                      selected
                        ? "border-white/40 shadow-lg ring-1 ring-white/15"
                        : "border-white/10 hover:border-white/25 hover:scale-[1.02]"
                    }`}
                    style={{
                      background: `linear-gradient(145deg, ${m.accent}55 0%, ${m.accent}12 42%, #0a0c12 100%)`,
                      boxShadow: selected
                        ? `0 0 0 1px ${m.accent}88, 0 8px 20px ${m.accent}20`
                        : undefined,
                    }}
                  >
                    <span
                      className="mb-2 block h-1.5 w-8 rounded-full"
                      style={{ background: m.accent }}
                      aria-hidden
                    />
                    <span className="block text-xs font-bold tracking-wide text-white sm:text-sm">
                      {m.displayName}
                    </span>
                    {m.blurb ? (
                      <span className="mt-1 block text-[10px] leading-snug text-white/50 sm:text-[11px]">
                        {m.blurb}
                      </span>
                    ) : null}
                    {selected ? (
                      <span className="absolute right-2 top-2 text-[10px] font-bold text-amber-200/90">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secondary actions — not the hero */}
          <nav className="flex flex-col gap-2">
            <Link
              href={quickPlayHref}
              className="rounded-xl border border-white/15 bg-black/45 px-5 py-3 text-center text-xs font-semibold tracking-[0.18em] text-white/80 transition hover:border-amber-400/35 hover:bg-black/60 hover:text-amber-100"
            >
              JOGO RÁPIDO · LOCAL
            </Link>
            <Link
              href={operatorSelectHref("/")}
              className="rounded-xl border border-white/10 bg-black/35 px-5 py-2.5 text-center text-xs font-semibold tracking-[0.18em] text-white/70 transition hover:border-white/20 hover:text-white"
            >
              OPERADOR
            </Link>
            {lastRoom?.code ? (
              <button
                type="button"
                disabled={rejoinBusy || quickMatchBusy || joinBusy}
                onClick={() => void handleRejoinLastRoom()}
                className="rounded-xl border border-emerald-400/35 bg-gradient-to-r from-emerald-900/80 to-emerald-800/70 px-5 py-3 text-center text-sm font-semibold tracking-wide text-emerald-100 shadow-lg shadow-emerald-950/30 transition hover:from-emerald-800 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {rejoinBusy
                  ? "Reentrando…"
                  : "Reentrar na última sala"}
                {!rejoinBusy && lastRoom.code ? (
                  <span className="mt-0.5 block font-mono text-[10px] font-normal tracking-[0.2em] text-emerald-200/55">
                    {lastRoom.code}
                    {lastRoom.mapId ? ` · ${lastRoom.mapId}` : ""}
                  </span>
                ) : null}
              </button>
            ) : null}
            {rejoinError && (
              <p
                role="alert"
                className="motion-safe:animate-ff-shake rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-300"
              >
                {rejoinError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={quickMatchBusy}
                onClick={() => void handleQuickMatchOnline()}
                className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-white/55 transition hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-55"
              >
                Match rápido
              </button>
              <button
                type="button"
                onClick={() => setServerBrowserOpen(true)}
                className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-white/55 transition hover:border-white/20 hover:text-white/80"
              >
                Procurar salas
              </button>
            </div>
            {quickMatchError && (
              <p
                role="alert"
                className="motion-safe:animate-ff-shake rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-300"
              >
                {quickMatchError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <MenuButton disabled title="Em breve">
                COSMÉTICOS
              </MenuButton>
              <Link
                href={quickPlayHref}
                className="rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-center text-xs font-semibold tracking-widest text-white/75 transition hover:border-white/20 hover:bg-black/60 hover:text-white"
              >
                TREINO
              </Link>
            </div>
          </nav>

          {/* Footer: quality + volume */}
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Qualidade
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-black/40 p-0.5">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQualityPersist(q.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition ${
                      quality === q.id
                        ? "bg-white/15 text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Volume
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40" aria-hidden>
                  ♪
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  aria-label="Volume"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    try {
                      localStorage.setItem("ff_volume", String(v));
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="h-1 w-28 cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-bold tracking-[0.22em] text-white/55">
                MISSÕES DO DIA
              </h2>
              <span className="text-[10px] font-semibold tabular-nums text-amber-300/80">
                {xpTotal} XP
              </span>
            </div>
            <ul className="space-y-2">
              {missions.map((m) => {
                const done = m.progress >= m.target;
                return (
                  <li
                    key={m.id}
                    className={`flex items-center justify-between gap-2 text-sm ${
                      done ? "text-emerald-200/85" : "text-white/70"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] ${
                          done
                            ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
                            : "border-white/20 text-white/30"
                        }`}
                        aria-hidden
                      >
                        {done ? "✓" : "○"}
                      </span>
                      <span className="truncate">{m.label}</span>
                      <span className="shrink-0 text-[10px] text-white/30">
                        {formatMissionProgress(m)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-amber-400/90">
                      +{m.xp} XP
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4">
            <LeaderboardPanel />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold tracking-wide text-white/90">
              Shooter tático top-down
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Crie uma sala, copie o convite e junte os amigos. Rounds TR vs CT,
              economia e bots no rádio — no navegador, sem download.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-white/45">
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Código da sala como porta de entrada
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Placar, recarregar, pausa e ajuda integrados
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Multiplayer privado com deep link
              </li>
            </ul>
            <Link
              href={quickPlayHref}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-xs font-bold tracking-[0.18em] text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              ENTRAR NO AQUECIMENTO
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Anuncie no jogo
              </span>
              <span className="text-[10px] text-white/25">outdoors · menu</span>
            </div>
            <AdBanner placement="lobby_banner" rotateMs={9000} />
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-white/30">
              Espaços premium em outdoors 3D e banners do lobby. Ideal para
              marcas gamer e SaaS.{" "}
              <span className="text-amber-500/70">anuncie@friendfire.gg</span>
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-white/10 bg-black/25 p-4 text-center">
            <p className="text-[11px] text-white/40">
              {GAME_NAME} · build MVP · Next.js + Three.js
            </p>
          </div>
        </div>
      </div>

      {roomPanel && (
        <RoomPanel
          mode={roomPanel}
          mapId={lastMap || "dust"}
          onClose={() => setRoomPanel(null)}
        />
      )}
      {serverBrowserOpen && (
        <ServerBrowser onClose={() => setServerBrowserOpen(false)} />
      )}
      {regionModalOpen && (
        <RegionModal
          region={region}
          pingMs={pingMs}
          onSelect={(r) => {
            setRegionPersist(r);
            setRegionModalOpen(false);
          }}
          onClose={() => setRegionModalOpen(false)}
        />
      )}
      {quickMatchBusy && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-match-title"
          aria-busy="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-sky-400/25 bg-[#0e1118] p-8 text-center shadow-2xl shadow-sky-950/40">
            <div
              className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400"
              aria-hidden
            />
            <h2
              id="quick-match-title"
              className="text-lg font-bold tracking-wide text-white"
            >
              Procurando partida…
            </h2>
            <p className="mt-2 text-xs text-white/40">
              Matchmaking em salas públicas
            </p>
            <button
              type="button"
              onClick={cancelQuickMatch}
              className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RegionModal({
  region,
  pingMs,
  onSelect,
  onClose,
}: {
  region: "BR" | "US";
  pingMs: number | null;
  onSelect: (r: "BR" | "US") => void;
  onClose: () => void;
}) {
  const pingLabel = pingMs != null ? `${pingMs}ms` : "medindo…";
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="region-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0e1118] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-amber-500/80">
              REDE
            </p>
            <h2
              id="region-modal-title"
              className="mt-1 text-xl font-black tracking-wide text-white"
            >
              Região
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">
          Preferência de matchmaking. Ping ao servidor atual atualiza ao vivo.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {(["BR", "US"] as const).map((r) => {
            const selected = region === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelect(r)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-amber-400/50 bg-amber-500/10"
                    : "border-white/10 bg-black/40 hover:border-white/25"
                }`}
              >
                <span className="text-sm font-bold tracking-wide text-white">
                  {r === "BR" ? "🇧🇷 Brasil" : "🇺🇸 Estados Unidos"}
                </span>
                <span className="font-mono text-xs tabular-nums text-white/55">
                  {selected ? pingLabel : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  children,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-black/45 px-5 py-3.5 text-center text-sm font-semibold tracking-widest text-white/75 motion-safe:transition-all motion-safe:duration-150 hover:border-white/20 hover:bg-black/60 hover:text-white hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
    >
      {children}
    </button>
  );
}
