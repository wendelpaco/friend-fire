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

  return (
    <GameCanvas
      mode={mode}
      roomCode={mode === "room" ? code : undefined}
    />
  );
}

export default function PlayPage() {
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-black">
      <Suspense fallback={<PlayLoading />}>
        <PlayContent />
      </Suspense>
    </div>
  );
}
