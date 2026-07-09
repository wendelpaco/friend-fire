"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";
import {
  getLastMapId,
  setLastMapId,
} from "@/domains/world";
import { getRoomClient } from "@/infrastructure/realtime/roomClient";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";

export type RoomPanelMode = "create" | "join";

/** Maps selectable at create time (ids match multi-map registry). */
const CREATE_MAPS = [
  { id: "dust", label: "Dust FF" },
  { id: "favela", label: "Favela" },
  { id: "yard", label: "Yard" },
] as const;

type CreateMapId = (typeof CREATE_MAPS)[number]["id"];

type LobbyCreateClient = {
  create(opts?: {
    mapId?: string;
    roomName?: string;
  }): Promise<{ code: string }>;
  join(code: string): Promise<void>;
  leave(): Promise<void>;
};

function asCreateClient(): LobbyCreateClient {
  return getRoomClient() as unknown as LobbyCreateClient;
}

function resolveMapId(id: string | undefined): CreateMapId {
  if (id === "dust" || id === "favela" || id === "yard") return id;
  return "dust";
}

interface RoomPanelProps {
  mode: RoomPanelMode;
  onClose: () => void;
  /** Preferred default map (e.g. last local map from MainMenu). */
  mapId?: string;
}

export function RoomPanel({
  mode,
  onClose,
  mapId: initialMapId,
}: RoomPanelProps) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [mapId, setMapId] = useState<CreateMapId>(() =>
    resolveMapId(initialMapId ?? getLastMapId()),
  );
  const [roomName, setRoomName] = useState("");

  const selectMap = (id: CreateMapId) => {
    setMapId(id);
    setLastMapId(id);
  };

  const handleClose = () => {
    // Drop lobby seat if host created a room but never entered /play.
    if (mode === "create" && createdCode) {
      void asCreateClient().leave();
    }
    onClose();
  };

  const goToRoom = (code: string, host = false, roomMapId?: string) => {
    const qs = new URLSearchParams({
      mode: "room",
      code,
    });
    if (host) qs.set("host", "1");
    // Map fixed at /play entry (GameCanvas boots once — no mid-session swap).
    // Host uses create selection; guests prefer server map when available.
    const map = roomMapId || (host ? mapId : undefined) || getLastMapId() || "dust";
    qs.set("map", map);
    setLastMapId(map);
    router.push(`/play?${qs.toString()}`);
  };

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const client = asCreateClient();
      const name = roomName.trim().slice(0, 32);
      const { code } = await client.create({
        mapId,
        ...(name ? { roomName: name } : {}),
      });
      setLastMapId(mapId);
      setCreatedCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar sala");
    } finally {
      setBusy(false);
    }
  };

  const handleEnterCreated = () => {
    if (!createdCode) return;
    // Host already holds the room seat from create(); play reuses it.
    goToRoom(createdCode, true, mapId);
  };

  const handleJoin = async () => {
    setError(null);
    const code = normalizeRoomCode(codeInput);
    if (!isValidRoomCode(code)) {
      setError("Código inválido. Use 6 caracteres (A–Z, 2–9, sem O/0/I/1).");
      return;
    }
    setBusy(true);
    try {
      // Join-only: missing/typo codes must not create a room or navigate.
      const client = asCreateClient();
      await client.join(code);
      // Prefer server mapId when present so guest loads the host's map.
      const snap = (
        getRoomClient() as unknown as {
          snapshot?: () => { mapId?: string | null };
        }
      ).snapshot?.();
      goToRoom(code, false, snap?.mapId || undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao entrar na sala";
      setError(msg.includes("Sala não existe") ? "Sala não existe" : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-panel-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e1118] p-6 shadow-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-amber-500/80">
              SALA PRIVADA
            </p>
            <h2
              id="room-panel-title"
              className="mt-1 text-xl font-black tracking-wide text-white"
            >
              {mode === "create" ? "Criar sala" : "Entrar por código"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {mode === "create" ? (
          <div className="mt-5">
            {createdCode ? (
              <>
                <p className="text-sm text-white/55">
                  Compartilhe este código com seus amigos:
                </p>
                <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-center">
                  <div className="font-mono text-3xl font-black tracking-[0.35em] text-amber-200">
                    {createdCode}
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/40">
                  Mapa:{" "}
                  <span className="text-white/60">
                    {CREATE_MAPS.find((m) => m.id === mapId)?.label ?? mapId}
                  </span>
                  {roomName.trim() ? (
                    <>
                      {" "}
                      · Nome:{" "}
                      <span className="text-white/60">{roomName.trim()}</span>
                    </>
                  ) : null}
                  . Colyseus — entre na sala e peça aos amigos para usar o mesmo
                  código.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleEnterCreated}
                    className="rounded-xl bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400"
                  >
                    Entrar na sala
                  </button>
                  <CopyInviteLink code={createdCode} host={false} />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(createdCode);
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    Copiar código
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-white/55">
                  Cria uma sala no servidor Colyseus e gera um código de 6
                  caracteres. Amigos entram com o mesmo código (servidor em{" "}
                  <code className="text-amber-200/80">npm run dev:server</code>
                  ).
                </p>

                <label
                  htmlFor="create-map-select"
                  className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40"
                >
                  Mapa
                </label>
                <select
                  id="create-map-select"
                  value={mapId}
                  onChange={(e) =>
                    selectMap(e.target.value as CreateMapId)
                  }
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-amber-400/60"
                >
                  {CREATE_MAPS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0e1118]">
                      {m.label}
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="create-room-name"
                  className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40"
                >
                  Nome da sala (opcional)
                </label>
                <input
                  id="create-room-name"
                  value={roomName}
                  maxLength={32}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Ex.: Run B amigos"
                  onChange={(e) => setRoomName(e.target.value.slice(0, 32))}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-400/60"
                />

                {error && (
                  <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCreate()}
                    className="rounded-xl bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    {busy ? "Criando…" : "Gerar código e criar"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="room-code-input"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40"
            >
              Código da sala
            </label>
            <input
              id="room-code-input"
              autoFocus
              value={codeInput}
              maxLength={8}
              spellCheck={false}
              autoComplete="off"
              placeholder="ABC234"
              onChange={(e) => {
                setCodeInput(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                );
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleJoin();
              }}
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.35em] text-amber-100 outline-none placeholder:text-white/20 focus:border-amber-400/60"
            />
            <p className="mt-2 text-xs text-white/35">
              6 caracteres · sem O, 0, I ou 1
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy || codeInput.length === 0}
                onClick={() => void handleJoin()}
                className="rounded-xl bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "Entrando…" : "Entrar na sala"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
