"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { operatorSelectHref } from "@/domains/operator";
import {
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";
import {
  getLastMapId,
  listMaps,
  setLastMapId,
  type MapId,
} from "@/domains/world";
import {
  getRoomClient,
  type RoomVisibility,
} from "@/infrastructure/realtime/roomClient";
import { CopyInviteLink } from "@/presentation/lobby/CopyInviteLink";

export type RoomPanelMode = "create" | "join";

/** Maps selectable at create time (registry order + accent/blurb). */
const CREATE_MAPS = listMaps().map((m) => ({
  id: m.id as MapId,
  label: m.displayName || m.id,
  accent: m.accent,
  blurb: m.blurb ?? "",
}));

type CreateMapId = MapId;

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
  /** Spec §2.1 — default public so room appears in browser. */
  const [isPublic, setIsPublic] = useState(true);

  const selectMap = (id: CreateMapId) => {
    setMapId(id);
    setLastMapId(id);
  };

  const handleClose = () => {
    // Drop lobby seat if host created a room but never entered /play.
    if (mode === "create" && createdCode) {
      void getRoomClient().leave();
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
    const map =
      roomMapId || (host ? mapId : undefined) || getLastMapId() || "dust";
    qs.set("map", map);
    setLastMapId(map);
    // Path B: operator select before match entry.
    router.push(operatorSelectHref(`/play?${qs.toString()}`));
  };

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const client = getRoomClient();
      const name = roomName.trim().slice(0, 32);
      const visibility: RoomVisibility = isPublic ? "public" : "private";
      const { code } = await client.create({
        mapId,
        visibility,
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
      const client = getRoomClient();
      await client.join(code);
      // Prefer server mapId when present so guest loads the host's map.
      const snap = client.snapshot();
      goToRoom(code, false, snap.mapId || undefined);
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
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0e1118] p-6 shadow-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-amber-500/80">
              {mode === "create"
                ? isPublic
                  ? "SALA PÚBLICA"
                  : "SALA PRIVADA"
                : "SALA"}
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
                  {" "}
                  ·{" "}
                  <span className="text-white/60">
                    {isPublic ? "Pública" : "Privada"}
                  </span>
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
                  <CopyInviteLink code={createdCode} host={false} mapId={mapId} />
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

                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Mapa
                </p>
                <div
                  className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
                  role="listbox"
                  aria-label="Selecionar mapa"
                >
                  {CREATE_MAPS.map((m) => {
                    const selected = mapId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectMap(m.id)}
                        className={`relative min-h-[5.5rem] overflow-hidden rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-white/40 shadow-lg ring-1 ring-white/20"
                            : "border-white/10 hover:border-white/25"
                        }`}
                        style={{
                          background: `linear-gradient(145deg, ${m.accent}55 0%, ${m.accent}14 42%, #0a0c12 100%)`,
                          boxShadow: selected
                            ? `0 0 0 1px ${m.accent}88, 0 8px 24px ${m.accent}22`
                            : undefined,
                        }}
                      >
                        <span
                          className="mb-2 block h-1.5 w-9 rounded-full"
                          style={{ background: m.accent }}
                          aria-hidden
                        />
                        <span className="block text-sm font-bold tracking-wide text-white">
                          {m.label}
                        </span>
                        {m.blurb ? (
                          <span className="mt-1 block text-[11px] leading-snug text-white/55">
                            {m.blurb}
                          </span>
                        ) : null}
                        {selected ? (
                          <span className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

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

                <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-white/85">
                      Sala pública
                    </span>
                    <span className="mt-0.5 block text-[11px] text-white/40">
                      {isPublic
                        ? "Aparece no browser de salas"
                        : "Só entra com o código"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                </label>

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
