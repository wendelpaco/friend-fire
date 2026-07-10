"use client";

import { Suspense } from "react";
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
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0a0c10] text-white/60">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
        <span className="text-sm tracking-wide">Preparando partida…</span>
      </div>
    ),
  },
);

function PlayLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0a0c10] text-white/60">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
      <span className="text-sm tracking-wide">Preparando partida…</span>
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
      {/* Soft tropical frame — RUSH-B style presentation chrome */}
      <div
        className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_80px_rgba(0,20,40,0.55)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-8 bg-gradient-to-b from-sky-900/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-t from-amber-950/35 to-transparent" />
      <Suspense fallback={<PlayLoading />}>
        <PlayContent />
      </Suspense>
    </div>
  );
}
