"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdBanner } from "@/presentation/ads/AdBanner";
import { GAME_NAME, GAME_TAGLINE } from "@/game/constants";
import {
  formatMissionProgress,
  getMissionsWithProgress,
  getXp,
  type DailyMission,
} from "@/domains/identity";
import { getLastMapId } from "@/domains/world";
import {
  RoomPanel,
  type RoomPanelMode,
} from "@/presentation/lobby/RoomPanel";
import { ServerBrowser } from "@/presentation/lobby/ServerBrowser";

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

export function MainMenu() {
  const [region, setRegion] = useState<"BR" | "US">(() =>
    readStorage("ff_region", "BR", (v) =>
      v === "BR" || v === "US" ? v : "BR",
    ),
  );
  const [volume, setVolume] = useState(() =>
    readStorage("ff_volume", 70, (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 70;
    }),
  );
  const [nickname, setNickname] = useState(() =>
    readStorage("ff_nickname", "Operador"),
  );
  const [editingName, setEditingName] = useState(false);
  const [roomPanel, setRoomPanel] = useState<RoomPanelMode | null>(null);
  const [serverBrowserOpen, setServerBrowserOpen] = useState(false);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [lastMap, setLastMap] = useState(() => getLastMapId("dust"));

  useEffect(() => {
    setMissions(getMissionsWithProgress());
    setXpTotal(getXp());
    setLastMap(getLastMapId("dust"));
  }, []);

  const quickPlayHref = `/play?mode=local&map=${encodeURIComponent(lastMap || "dust")}`;

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
    try {
      localStorage.setItem("ff_region", r);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090e] text-white">
      {/* cinematic bg */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,#3b1a08_0%,transparent_50%),radial-gradient(ellipse_at_15%_85%,#0a1628_0%,transparent_45%),linear-gradient(180deg,#12151c_0%,#07090e_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* floating particles hint */}
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-950/40 to-transparent" />
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

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl gap-10 px-5 py-8 lg:grid-cols-[1fr_340px] lg:items-center lg:px-10">
        {/* Left: logo + nav */}
        <div className="max-w-md">
          <div className="mb-8">
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
                    className="text-left"
                  >
                    <div className="truncate font-semibold text-amber-100">
                      {nickname}
                    </div>
                    <div className="text-[11px] text-white/40">
                      {xpTotal} XP · Recruta · clique para editar
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <Link
              href={quickPlayHref}
              className="rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3.5 text-center text-sm font-black tracking-[0.2em] text-black shadow-lg shadow-amber-900/35 transition hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-700/40"
            >
              JOGO RÁPIDO
            </Link>
            <MenuButton onClick={() => setRoomPanel("create")}>
              CRIAR SALA
            </MenuButton>
            <MenuButton onClick={() => setRoomPanel("join")}>
              ENTRAR POR CÓDIGO
            </MenuButton>
            <MenuButton onClick={() => setServerBrowserOpen(true)}>
              PROCURAR SALAS
            </MenuButton>
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

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-1 rounded-lg bg-black/40 p-0.5">
              {(["BR", "US"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegionPersist(r)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                    region === r
                      ? "bg-white/15 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {r === "BR" ? "🇧🇷 BR" : "🇺🇸 US"}
                </button>
              ))}
            </div>
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
                className="h-1 w-24 cursor-pointer accent-amber-500"
              />
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
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <h2 className="text-sm font-bold tracking-wide text-white/90">
              Shooter tático top-down
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Rounds TR vs CT, economia, killfeed e bots no rádio. Jogue no
              navegador — sem download.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-white/45">
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Mapa Dust FF com outdoors patrocinados
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Placar, recarregar, pausa e ajuda integrados
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">▸</span>
                Multiplayer online e matchmaking em breve
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
      className="rounded-xl border border-white/10 bg-black/45 px-5 py-3.5 text-center text-sm font-semibold tracking-widest text-white/75 transition hover:border-white/20 hover:bg-black/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
