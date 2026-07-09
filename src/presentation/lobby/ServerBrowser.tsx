"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setLastMapId } from "@/domains/world";
import {
  getRoomClient,
  type RoomListItem,
} from "@/infrastructure/realtime/roomClient";

function roomDisplayName(room: RoomListItem): string {
  if (room.roomName?.trim()) return room.roomName.trim();
  return `Sala ${room.code}`;
}

function playersLabel(room: RoomListItem): string {
  const max = room.maxClients > 0 ? room.maxClients : 10;
  return `${room.clients}/${max}`;
}

interface ServerBrowserProps {
  onClose: () => void;
}

export function ServerBrowser({ onClose }: ServerBrowserProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const mounted = useRef(true);

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await getRoomClient().listRooms();
      if (!mounted.current) return;
      setRooms(Array.isArray(list) ? list : []);
    } catch (e) {
      if (!mounted.current) return;
      const msg =
        e instanceof Error
          ? e.message
          : "Servidor multiplayer indisponível.";
      setError(
        msg.includes("Failed to list") || msg.includes("fetch")
          ? "Servidor multiplayer indisponível. Rode `npm run dev:server` e tente de novo."
          : msg,
      );
      setRooms([]);
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchRooms(false);
    return () => {
      mounted.current = false;
    };
  }, [fetchRooms]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void fetchRooms(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchRooms]);

  const goToRoom = (code: string, mapId?: string) => {
    const qs = new URLSearchParams({
      mode: "room",
      code,
    });
    // Map fixed at /play boot — pass list mapId when known.
    if (mapId) qs.set("map", mapId);
    router.push(`/play?${qs.toString()}`);
  };

  const handleJoin = async (room: RoomListItem) => {
    setError(null);
    setJoiningCode(room.code);
    try {
      await getRoomClient().join(room.code);
      goToRoom(room.code, room.mapId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao entrar na sala";
      setError(msg.includes("Sala não existe") ? "Sala não existe" : msg);
    } finally {
      if (mounted.current) setJoiningCode(null);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-browser-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/15 bg-[#0e1118] p-6 shadow-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-amber-500/80">
              MULTIPLAYER
            </p>
            <h2
              id="server-browser-title"
              className="mt-1 text-xl font-black tracking-wide text-white"
            >
              Procurar salas
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchRooms(false)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/45">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-amber-500"
            />
            Auto 5s
          </label>
          <span className="ml-auto text-[10px] tabular-nums text-white/30">
            {rooms.length} sala{rooms.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-white/10">
          {loading && rooms.length === 0 && !error ? (
            <p className="px-4 py-10 text-center text-sm text-white/45">
              Carregando salas…
            </p>
          ) : rooms.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-white/70">
                Nenhuma sala aberta
              </p>
              <p className="mt-1 text-xs text-white/40">
                Crie uma sala ou aguarde outros jogadores. Servidor:{" "}
                <code className="text-amber-200/70">npm run dev:server</code>
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[#141820] text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Nome</th>
                  <th className="px-3 py-2.5 font-semibold">Mapa</th>
                  <th className="px-3 py-2.5 font-semibold">Jogadores</th>
                  <th className="px-3 py-2.5 font-semibold">Código</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Entrar
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const key = room.roomId || room.code;
                  const busy = joiningCode === room.code;
                  return (
                    <tr
                      key={key}
                      className="border-t border-white/5 text-white/80 transition hover:bg-white/[0.03]"
                    >
                      <td className="max-w-[10rem] truncate px-3 py-2.5 font-medium text-white/90">
                        {roomDisplayName(room)}
                      </td>
                      <td className="px-3 py-2.5 text-white/65">
                        {room.mapName || room.mapId || "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-white/65">
                        {playersLabel(room)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs tracking-wider text-amber-200/90">
                        {room.code}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={busy || joiningCode !== null || !room.code}
                          onClick={() => void handleJoin(room)}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold tracking-wide text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy ? "…" : "Entrar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
