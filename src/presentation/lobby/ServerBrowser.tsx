"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMapById, listMaps, setLastMapId } from "@/domains/world";
import {
  getRoomClient,
  type ListRoomsOptions,
  type RoomListItem,
  type RoomRegion,
  type RoomVisibility,
} from "@/infrastructure/realtime/roomClient";

/** "" = All regions (no query param). */
type RegionFilter = "" | RoomRegion;

const REGION_FILTERS: { id: RegionFilter; label: string }[] = [
  { id: "", label: "All" },
  { id: "BR", label: "BR" },
  { id: "US", label: "US" },
];

const FILTER_MAPS = listMaps().map((m) => ({
  id: m.id,
  label: m.displayName || m.id,
  accent: m.accent,
}));

function roomDisplayName(room: RoomListItem): string {
  if (room.roomName?.trim()) return room.roomName.trim();
  return `Sala ${room.code}`;
}

function playersLabel(room: RoomListItem): string {
  const max = room.maxClients > 0 ? room.maxClients : 10;
  return `${room.clients}/${max}`;
}

function visibilityOf(room: RoomListItem): RoomVisibility {
  return room.visibility === "private" ? "private" : "public";
}

/** Room is full when clients >= maxClients (max 0 → treat as 10). */
function isRoomFull(room: RoomListItem): boolean {
  const max = room.maxClients > 0 ? room.maxClients : 10;
  return room.clients >= max;
}

function mapChip(mapId: string, mapName?: string): {
  label: string;
  accent: string;
} {
  const map = getMapById(mapId || "dust");
  return {
    label: mapName?.trim() || map.displayName || map.id || "—",
    accent: map.accent,
  };
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
  const [mapFilter, setMapFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("");
  const [hasSlotsOnly, setHasSlotsOnly] = useState(false);
  const mounted = useRef(true);

  const buildListOpts = useCallback((): ListRoomsOptions => {
    const opts: ListRoomsOptions = { visibility: "public" };
    if (mapFilter) opts.mapId = mapFilter;
    if (regionFilter) opts.region = regionFilter;
    if (hasSlotsOnly) opts.hasSlots = true;
    return opts;
  }, [mapFilter, regionFilter, hasSlotsOnly]);

  const fetchRooms = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const list = await getRoomClient().listRooms(buildListOpts());
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
    },
    [buildListOpts],
  );

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
    // Map fixed at /play boot — pass list/server mapId when known.
    if (mapId) {
      qs.set("map", mapId);
      setLastMapId(mapId);
    }
    router.push(`/play?${qs.toString()}`);
  };

  const handleJoin = async (room: RoomListItem) => {
    if (isRoomFull(room)) return;
    setError(null);
    setJoiningCode(room.code);
    try {
      const client = getRoomClient();
      await client.join(room.code);
      const snap = client.snapshot();
      goToRoom(room.code, snap.mapId || room.mapId || undefined);
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
          <div
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5"
            role="group"
            aria-label="Filtrar por região"
          >
            {REGION_FILTERS.map((r) => (
              <button
                key={r.id || "all"}
                type="button"
                onClick={() => setRegionFilter(r.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold tracking-wide transition ${
                  regionFilter === r.id
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-white/50">
            <span className="sr-only">Mapa</span>
            <select
              value={mapFilter}
              onChange={(e) => setMapFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs font-semibold text-white/85 outline-none focus:border-amber-400/50"
              aria-label="Filtrar por mapa"
            >
              <option value="" className="bg-[#0e1118]">
                Todos os mapas
              </option>
              {FILTER_MAPS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0e1118]">
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/45">
            <input
              type="checkbox"
              checked={hasSlotsOnly}
              onChange={(e) => setHasSlotsOnly(e.target.checked)}
              className="accent-amber-500"
            />
            Só com vaga
          </label>
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
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[#141820] text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Nome</th>
                  <th className="px-3 py-2.5 font-semibold">Mapa</th>
                  <th className="px-3 py-2.5 font-semibold">Visib.</th>
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
                  const vis = visibilityOf(room);
                  const full = isRoomFull(room);
                  const chip = mapChip(room.mapId, room.mapName);
                  return (
                    <tr
                      key={key}
                      className="border-t border-white/5 text-white/80 transition hover:bg-white/[0.03]"
                    >
                      <td className="max-w-[10rem] truncate px-3 py-2.5 font-medium text-white/90">
                        {roomDisplayName(room)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-white/80"
                          title={chip.label}
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/20"
                            style={{ background: chip.accent }}
                            aria-hidden
                          />
                          <span className="truncate">{chip.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            vis === "public"
                              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300/90"
                              : "border-white/15 bg-white/5 text-white/50"
                          }`}
                        >
                          {vis === "public" ? "Pública" : "Privada"}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2.5 tabular-nums ${
                          full ? "font-semibold text-red-300/90" : "text-white/65"
                        }`}
                      >
                        {playersLabel(room)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs tracking-wider text-amber-200/90">
                        {room.code}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={
                            full ||
                            busy ||
                            joiningCode !== null ||
                            !room.code
                          }
                          onClick={() => void handleJoin(room)}
                          title={full ? "Sala cheia" : undefined}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            full
                              ? "border border-white/10 bg-white/5 text-white/45"
                              : "bg-amber-500 text-black hover:bg-amber-400"
                          }`}
                        >
                          {full ? "Cheia" : busy ? "…" : "Entrar"}
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
