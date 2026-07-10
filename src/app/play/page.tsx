"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";

const GameCanvas = dynamic(
  () =>
    import("@/presentation/game/GameCanvas").then((m) => m.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#07090e] text-white">
        <div className="text-[10px] font-bold tracking-[0.5em] text-amber-500/90">
          FRIEND FIRE
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-amber-600 to-amber-300" />
        </div>
        <span className="text-xs tracking-wide text-white/45">
          Preparando protocolo de combate…
        </span>
      </div>
    ),
  },
);

const LOADING_STAGES = [
  "Conectando à sala…",
  "Carregando mapa…",
  "Sincronizando estado…",
  "Preparando protocolo de combate…",
];

const TACTICAL_TIPS = [
  "Parado, seu primeiro tiro é perfeito.",
  "Shift-walk: ninguém te ouve.",
  "Fumaça bloqueia visão, não bala.",
  "Plante a C4 e mude de posição.",
  "Compre colete — vale cada $.",
  "Olhe o minimapa. Sempre.",
];

function PlayLoading() {
  const [stage, setStage] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const stageTimer = setInterval(() => setStage((s) => (s + 1) % LOADING_STAGES.length), 2200);
    const tipTimer = setInterval(() => setTip((t) => (t + 1) % TACTICAL_TIPS.length), 5000);
    return () => { clearInterval(stageTimer); clearInterval(tipTimer); };
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-[#07090e] text-white">
      <div className="text-center motion-safe:animate-ff-fade-in">
        <div className="text-[10px] font-bold tracking-[0.5em] text-amber-500/90">
          FRIEND FIRE
        </div>
        <div className="mt-2 text-xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 bg-clip-text text-transparent">
            Friend
          </span>
          <span className="text-white"> Fire</span>
        </div>
      </div>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="motion-safe:animate-pulse h-full w-1/3 rounded-full bg-gradient-to-r from-amber-600 to-amber-300" />
      </div>
      <span className="text-xs tracking-wide text-white/45">{LOADING_STAGES[stage]}</span>
      <span
        key={tip}
        className="max-w-xs text-center text-[11px] italic leading-relaxed text-white/30 motion-safe:animate-ff-slide-up"
      >
        &ldquo;{TACTICAL_TIPS[tip]}&rdquo;
      </span>
    </div>
  );
}

function PlayContent() {
  const searchParams = useSearchParams();
  const rawMode = searchParams.get("mode");
  const mode = rawMode === "room" ? "room" : "local";
  const rawCode = searchParams.get("code");
  const code =
    rawCode && isValidRoomCode(rawCode)
      ? normalizeRoomCode(rawCode)
      : undefined;
  const isHost = searchParams.get("host") === "1";
  // Map fixed at entry (local ?map= or host create navigation). Room guests
  // should receive the same ?map= from invite/host; no mid-session reload.
  const mapId = searchParams.get("map") || undefined;
  // Squad party (Meta-3): invitees share host party via ?party= (default code).
  const rawParty = searchParams.get("party");
  const partyId =
    rawParty && rawParty.trim().length > 0
      ? rawParty.trim().slice(0, 24)
      : isHost && code
        ? code
        : undefined;

  return (
    <GameCanvas
      mode={mode}
      roomCode={mode === "room" ? code : undefined}
      isHost={isHost}
      mapId={mapId}
      partyId={mode === "room" ? partyId : undefined}
    />
  );
}

export default function PlayPage() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0a1520]">
      {/* Cinematic frame — RUSH-B style presentation chrome */}
      <div
        className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_100px_rgba(0,20,40,0.6)]"
        aria-hidden
      />
      {/* Corner vignettes */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-10 bg-gradient-to-b from-sky-900/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-12 bg-gradient-to-t from-amber-950/40 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-6 bg-gradient-to-r from-sky-950/30 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-6 bg-gradient-to-l from-amber-950/20 to-transparent" />
      <Suspense fallback={<PlayLoading />}>
        <PlayContent />
      </Suspense>
    </div>
  );
}
