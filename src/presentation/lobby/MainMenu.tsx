/* ============================================================
   Friend Fire — MainMenu (Git City-inspired tactical lobby)
   ============================================================ */

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
import { LeaderboardPanel } from "@/presentation/lobby/LeaderboardPanel";
import {
  RoomPanel,
  type RoomPanelMode,
} from "@/presentation/lobby/RoomPanel";
import { ServerBrowser } from "@/presentation/lobby/ServerBrowser";

/* ---- helpers (preserved from original) ---- */
function readStorage<T>(key: string, fallback: T, parse?: (v: string) => T): T {
  if (typeof window === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); if (raw == null) return fallback; return parse ? parse(raw) : (raw as T); }
  catch { return fallback; }
}
const DEFAULT_NICKNAME = "Operador";
const DEFAULT_REGION: "BR" | "US" = "BR";
const DEFAULT_VOLUME = 70;

/* ================================================================ */
export function MainMenu() {
  const router = useRouter();
  const [region, setRegion] = useState<"BR" | "US">(DEFAULT_REGION);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [nickname, setNickname] = useState(DEFAULT_NICKNAME);
  const [editingName, setEditingName] = useState(false);
  const [roomPanel, setRoomPanel] = useState<RoomPanelMode | null>(null);
  const [serverBrowserOpen, setServerBrowserOpen] = useState(false);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [lastMap, setLastMap] = useState("dust");
  const [quickMatchBusy, setQuickMatchBusy] = useState(false);
  const [quickMatchError, setQuickMatchError] = useState<string | null>(null);
  const quickMatchGen = useRef(0);
  const [lastRoom, setLastRoomState] = useState<LastRoom | null>(null);
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [quality, setQuality] = useState<GraphicsQuality>("medium");

  /* ---- hydrate from localStorage ---- */
  useEffect(() => {
    setNickname(readStorage("ff_nickname", DEFAULT_NICKNAME));
    setRegion(readStorage("ff_region", DEFAULT_REGION, (v) => v === "BR" || v === "US" ? v : DEFAULT_REGION));
    setVolume(readStorage("ff_volume", DEFAULT_VOLUME, (v) => { const n = Number(v); return Number.isFinite(n) ? n : DEFAULT_VOLUME; }));
    setMissions(getMissionsWithProgress());
    setXpTotal(getXp());
    setLastMap(getLastMapId("dust"));
    setLastRoomState(getLastRoom());
    setQuality(getGraphicsQuality());
  }, []);

  /* ---- ping ---- */
  useEffect(() => { let cancelled = false;
    measurePing().then((ms) => { if (!cancelled) setPingMs(ms); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const playUrl = `/play?mode=local&map=${encodeURIComponent(lastMap || "dust")}`;
  const quickPlayHref = operatorSelectHref(playUrl);
  const rank = xpToTier(xpTotal);
  const rankProgress = progressInTier(xpTotal);
  const lobbyMaps = listMaps();

  const selectLobbyMap = (id: string) => {
    const mapId = (id === "favela" || id === "yard" || id === "dust" ? id : "dust") as MapId;
    setLastMapId(mapId); setLastMap(mapId);
  };
  const cancelQuickMatch = () => { quickMatchGen.current += 1; setQuickMatchBusy(false); };

  const handleRejoinLastRoom = async () => {
    const stored = getLastRoom(); if (!stored?.code) { setLastRoomState(null); return; }
    setRejoinError(null); setRejoinBusy(true);
    try {
      const client = getRoomClient(); await client.join(stored.code);
      const snap = client.snapshot(); const map = snap.mapId || stored.mapId || getLastMapId("dust") || "dust";
      setLastMapId(map); setLastMap(map);
      router.push(operatorSelectHref(`/play?${new URLSearchParams({ mode: "room", code: stored.code, map }).toString()}`));
    } catch (e) { clearLastRoom(); setLastRoomState(null);
      setRejoinError(e instanceof Error ? e.message : "Falha ao reentrar na última sala");
    } finally { setRejoinBusy(false); }
  };

  const handleQuickMatchOnline = async () => {
    const gen = ++quickMatchGen.current; setQuickMatchError(null); setQuickMatchBusy(true);
    const minDisplay = new Promise<void>((r) => setTimeout(r, 500));
    const client = getRoomClient();
    try {
      const mapId = lastMap || getLastMapId("dust") || "dust";
      const [result] = await Promise.all([client.quickMatch({ mapId }), minDisplay]);
      const { code, host } = result;
      if (gen !== quickMatchGen.current) { if (client.getCode() === code) await client.leave(); return; }
      const snap = client.snapshot(); const map = snap.mapId || mapId;
      setLastMapId(map); setLastMap(map);
      router.push(operatorSelectHref(`/play?${new URLSearchParams({ mode: "room", code, map, ...(host ? { host: "1" } : {}) }).toString()}`));
    } catch (e) { if (gen !== quickMatchGen.current) return;
      const msg = e instanceof Error ? e.message : "Servidor multiplayer indisponível.";
      setQuickMatchError(msg.includes("Failed to list") || msg.includes("fetch") ? "Servidor offline. Rode npm run dev:server" : msg);
    } finally { if (gen === quickMatchGen.current) setQuickMatchBusy(false); }
  };

  const saveNickname = (name: string) => {
    const clean = name.trim().slice(0, 16) || "Operador"; setNickname(clean); setEditingName(false);
    try { localStorage.setItem("ff_nickname", clean); } catch {}
  };
  const setRegionPersist = (r: "BR" | "US") => { setRegion(r); persistIdentityRegion(r); try { localStorage.setItem("ff_region", r); } catch {} };
  const setQualityPersist = (q: GraphicsQuality) => { setQuality(q); setGraphicsQuality(q); };
  const pingLabel = pingMs != null ? `${pingMs}ms` : "—";

  /* ================================================================ */
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0D10] font-sans text-[#F4EFE3]">
      {/* ---- Background layers ---- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,179,0,0.06)_0%,transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(10,22,40,0.3)_0%,transparent_50%)]" />
        {/* Scanlines */}
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)" }} />
        {/* Vignette */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)" }} />
      </div>

      {/* ---- Top bar: region + ping + quality ---- */}
      <div className="relative z-20 flex items-center justify-between border-b-2 border-[rgba(255,179,0,0.16)] bg-black/30 px-5 py-2 backdrop-blur-sm">
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#B9B29F]">{GAME_NAME}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tabular-nums text-[#6F6A5B]">{pingLabel}</span>
          <div className="flex items-center gap-0.5 rounded bg-black/40 p-0.5">
            {(["BR", "US"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRegionPersist(r)}
                className={`rounded-sm px-2 py-0.5 text-[10px] font-bold tracking-wide transition ${region === r ? "bg-white/12 text-white" : "text-white/30 hover:text-white/55"}`}>
                {r === "BR" ? "BR" : "US"}
              </button>
            ))}
          </div>
          <input type="range" min={0} max={100} value={volume} aria-label="Volume"
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); try { localStorage.setItem("ff_volume", String(v)); } catch {} }}
            className="h-1 w-20 cursor-pointer accent-[#FFB300]" />
        </div>
      </div>

      {/* ---- Hero section ---- */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-12 text-center">
        {/* Logo */}
        <div>
          <p className="mb-3 text-[10px] font-bold tracking-[0.35em] text-[#FFB300]">
            ONLINE · BROWSER · GRÁTIS
          </p>
          <h1 className="text-5xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl">
            <span className="bg-gradient-to-r from-red-500 via-orange-400 to-[#FFD166] bg-clip-text text-transparent">
              FRIEND
            </span>
            <span className="text-[#F4EFE3]"> FIRE</span>
          </h1>
          <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-[#6F6A5B]">
            TÁTICO · TOP-DOWN · MULTIPLAYER
          </p>
        </div>

        {/* ---- Profile card ---- */}
        <div className="w-full max-w-sm rounded-sm border-2 border-[rgba(255,179,0,0.16)] bg-[#12151A]/80 px-5 py-3.5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFB300] text-sm font-black text-[#0B0D10]">
              {nickname.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              {editingName ? (
                <input autoFocus defaultValue={nickname} maxLength={16}
                  onBlur={(e) => saveNickname(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNickname((e.target as HTMLInputElement).value); if (e.key === "Escape") setEditingName(false); }}
                  className="w-full border-2 border-[#FFB300]/40 bg-black/50 px-2 py-1 text-sm text-[#F4EFE3] outline-none placeholder:text-[#6F6A5B]" />
              ) : (
                <button type="button" onClick={() => setEditingName(true)} className="w-full text-left">
                  <div className="text-sm font-bold">{nickname}</div>
                  <div className="text-[10px] text-[#6F6A5B]">
                    <span className="font-semibold text-[#FFD166]">{rank.name}</span>
                    {" · "}{xpTotal.toLocaleString("pt-BR")} XP
                  </div>
                </button>
              )}
            </div>
          </div>
          {/* XP bar */}
          <div className="mt-3 h-1 overflow-hidden bg-white/8">
            <div className="h-full bg-[#FFB300] transition-[width] duration-300"
              style={{ width: `${Math.round(rankProgress * 100)}%` }} />
          </div>
        </div>

        {/* ---- Primary CTA ---- */}
        <div className="w-full max-w-sm space-y-3">
          <Link href={quickPlayHref}
            className="btn-press-ff flex items-center justify-center gap-2 border-2 border-[#B87900] bg-[#FFB300] px-6 py-4 text-center text-sm font-black tracking-[0.15em] text-[#0B0D10]"
            style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.5)" }}>
            JOGO RÁPIDO
          </Link>
          <button type="button" disabled={quickMatchBusy} onClick={() => void handleQuickMatchOnline()}
            className="btn-press-ff w-full border-2 border-[#4EA3FF]/40 bg-[#4EA3FF]/15 px-6 py-3.5 text-sm font-bold tracking-[0.12em] text-[#4EA3FF] disabled:opacity-40"
            style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.4)" }}>
            {quickMatchBusy ? "PROCURANDO PARTIDA…" : "JOGO RÁPIDO ONLINE"}
          </button>
          {quickMatchError && (
            <p role="alert" className="border-2 border-[#FF3B30]/30 bg-[#FF3B30]/10 px-3 py-2 text-xs text-red-300">
              {quickMatchError}
            </p>
          )}
        </div>

        {/* ---- Secondary actions ---- */}
        <div className="grid w-full max-w-sm grid-cols-2 gap-2">
          <button type="button" onClick={() => setRoomPanel("create")}
            className="btn-press-ff border-2 border-[rgba(255,179,0,0.16)] bg-white/[0.04] px-4 py-3 text-xs font-semibold tracking-wider text-[#B9B29F] hover:border-[rgba(255,179,0,0.35)] hover:bg-white/[0.08] hover:text-[#F4EFE3]"
            style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
            CRIAR SALA
          </button>
          <button type="button" onClick={() => setRoomPanel("join")}
            className="btn-press-ff border-2 border-[rgba(255,179,0,0.16)] bg-white/[0.04] px-4 py-3 text-xs font-semibold tracking-wider text-[#B9B29F] hover:border-[rgba(255,179,0,0.35)] hover:bg-white/[0.08] hover:text-[#F4EFE3]"
            style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
            ENTRAR POR CÓDIGO
          </button>
          <button type="button" onClick={() => setServerBrowserOpen(true)}
            className="btn-press-ff border-2 border-[rgba(255,179,0,0.16)] bg-white/[0.04] px-4 py-3 text-xs font-semibold tracking-wider text-[#B9B29F] hover:border-[rgba(255,179,0,0.35)] hover:bg-white/[0.08] hover:text-[#F4EFE3]"
            style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
            PROCURAR SALAS
          </button>
          <Link href={quickPlayHref}
            className="btn-press-ff border-2 border-[rgba(255,179,0,0.16)] bg-white/[0.04] px-4 py-3 text-center text-xs font-semibold tracking-wider text-[#B9B29F] hover:border-[rgba(255,179,0,0.35)] hover:bg-white/[0.08] hover:text-[#F4EFE3]"
            style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
            TREINO
          </Link>
        </div>

        {/* ---- Rejoin ---- */}
        {lastRoom?.code ? (
          <button type="button" disabled={rejoinBusy || quickMatchBusy} onClick={() => void handleRejoinLastRoom()}
            className="btn-press-ff w-full max-w-sm border-2 border-[#6FDB8B]/30 bg-[#6FDB8B]/10 px-4 py-3 text-xs font-semibold text-[#6FDB8B] disabled:opacity-40"
            style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
            {rejoinBusy ? "Reentrando…" : `REENTRAR NA ÚLTIMA SALA · ${lastRoom.code}`}
          </button>
        ) : null}
        {rejoinError && (
          <p role="alert" className="w-full max-w-sm border-2 border-[#FF3B30]/30 bg-[#FF3B30]/10 px-3 py-2 text-xs text-red-300">
            {rejoinError}
          </p>
        )}

        {/* ---- Map select ---- */}
        <div className="w-full max-w-sm text-left">
          <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#6F6A5B]">MAPA</p>
          <div className="grid grid-cols-3 gap-1.5">
            {lobbyMaps.map((m) => {
              const selected = lastMap === m.id;
              return (
                <button key={m.id} type="button" onClick={() => selectLobbyMap(m.id)}
                  className={`border-2 p-2.5 text-left transition ${selected ? "border-[#FFB300]/40" : "border-[rgba(255,179,0,0.12)] hover:border-[rgba(255,179,0,0.25)]"}`}
                  style={{ background: `linear-gradient(145deg, ${m.accent}33 0%, ${m.accent}08 50%, transparent 100%)` }}>
                  <span className="mb-1.5 block h-1 w-6 rounded-full" style={{ background: m.accent }} />
                  <span className="block text-[11px] font-bold">{m.displayName}</span>
                  {selected && <span className="mt-0.5 block text-[9px] font-bold text-[#FFB300]">ATIVO</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Missions ---- */}
        <div className="w-full max-w-sm rounded-sm border-2 border-[rgba(255,179,0,0.12)] bg-[#12151A]/50 px-4 py-3.5 text-left">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#6F6A5B]">MISSÕES</h3>
            <span className="text-[10px] font-bold tabular-nums text-[#FFB300]">{xpTotal} XP</span>
          </div>
          <ul className="space-y-1.5">
            {missions.slice(0, 3).map((m) => {
              const done = m.progress >= m.target;
              return (
                <li key={m.id} className={`flex items-center justify-between gap-2 text-[11px] ${done ? "text-[#6FDB8B]/80" : "text-[#B9B29F]"}`}>
                  <span className="truncate">{m.label}</span>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#FFB300]">+{m.xp}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---- Leaderboard + Sponsor ---- */}
        <div className="w-full max-w-sm space-y-3">
          <LeaderboardPanel />
          <AdBanner placement="lobby_banner" compact rotateMs={8000} />
        </div>
      </div>

      {/* ---- Modals ---- */}
      {roomPanel && <RoomPanel mode={roomPanel} mapId={lastMap || "dust"} onClose={() => setRoomPanel(null)} />}
      {serverBrowserOpen && <ServerBrowser onClose={() => setServerBrowserOpen(false)} />}
      {quickMatchBusy && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs border-2 border-[#4EA3FF]/20 bg-[#12151A] p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#4EA3FF]/30 border-t-[#4EA3FF]" />
            <p className="text-sm font-bold">Procurando partida…</p>
            <button type="button" onClick={cancelQuickMatch}
              className="btn-press-ff mt-4 w-full border-2 border-[rgba(255,179,0,0.16)] bg-white/5 py-2.5 text-xs font-semibold text-[#B9B29F] hover:bg-white/10"
              style={{ boxShadow: "2px 2px 0 0 rgba(0,0,0,0.3)" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
