"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isValidRoomCode,
  normalizeRoomCode,
} from "@/domains/session";
import { getRoomClient } from "@/infrastructure/realtime/roomClient";

export type RoomPanelMode = "create" | "join";

interface RoomPanelProps {
  mode: RoomPanelMode;
  onClose: () => void;
}

export function RoomPanel({ mode, onClose }: RoomPanelProps) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const goToRoom = (code: string) => {
    router.push(`/play?mode=room&code=${encodeURIComponent(code)}`);
  };

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const client = getRoomClient();
      const { code } = await client.create();
      setCreatedCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar sala");
    } finally {
      setBusy(false);
    }
  };

  const handleEnterCreated = () => {
    if (!createdCode) return;
    goToRoom(createdCode);
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
      // Soft validation: try Colyseus join. If host has not entered /play yet,
      // room may be empty — still allow navigation; play page joinOrCreates.
      const client = getRoomClient();
      try {
        await client.join(code);
      } catch {
        // Host may still be on the lobby code screen; play will joinOrCreate.
      }
      goToRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar na sala");
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
            onClick={onClose}
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
                  Colyseus — entre na sala e peça aos amigos para usar o mesmo
                  código. Combate ainda roda em híbrido local no cliente.
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleEnterCreated}
                    className="rounded-xl bg-amber-500 py-3 text-sm font-bold tracking-wide text-black transition hover:bg-amber-400"
                  >
                    Entrar na sala
                  </button>
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
                    onClick={onClose}
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
                onClick={onClose}
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
