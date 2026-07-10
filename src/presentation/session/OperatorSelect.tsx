"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOperatorById,
  getOperatorPrefs,
  getSkinById,
  listOperators,
  listSkinsForOperator,
  resolveOperatorNext,
  setOperatorPrefs,
  type GenderPresentation,
  type OperatorDef,
  type OperatorId,
  type SkinDef,
} from "@/domains/operator";
import { Button, Panel } from "@/presentation/ui/Panel";

type GenderFilter = "all" | GenderPresentation;

export type OperatorSelectProps = {
  /** Raw `next` search param (may be encoded). */
  next?: string | null;
};

/**
 * Character + skin select (Meta-1 Path B).
 * Confirm → setOperatorPrefs + router.push(next).
 */
export function OperatorSelect({ next }: OperatorSelectProps) {
  const router = useRouter();
  const operators = listOperators();

  const [filter, setFilter] = useState<GenderFilter>("all");
  const [operatorId, setOperatorId] = useState<OperatorId>("brick");
  const [skinId, setSkinId] = useState("brick-default");
  const [ready, setReady] = useState(false);

  // Hydrate prefs from localStorage after mount (SSR-safe).
  useEffect(() => {
    const prefs = getOperatorPrefs();
    setOperatorId(prefs.operatorId);
    setSkinId(prefs.skinId);
    setReady(true);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return [...operators];
    return operators.filter((o) => o.gender === filter);
  }, [operators, filter]);

  const selectedOp: OperatorDef =
    getOperatorById(operatorId) ?? operators[0];
  const skins = listSkinsForOperator(selectedOp.id);
  const skinCandidate = getSkinById(skinId);
  const selectedSkin: SkinDef =
    skinCandidate && skinCandidate.operatorId === selectedOp.id
      ? skinCandidate
      : skins[0];

  const pickOperator = (op: OperatorDef) => {
    setOperatorId(op.id);
    const prefs = getOperatorPrefs();
    if (prefs.operatorId === op.id) {
      setSkinId(prefs.skinId);
    } else {
      setSkinId(op.defaultSkinId);
    }
  };

  const confirm = () => {
    setOperatorPrefs({
      operatorId: selectedOp.id,
      skinId: selectedSkin?.id ?? selectedOp.defaultSkinId,
    });
    router.push(resolveOperatorNext(next));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--ff-void)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#3b1a08_0%,transparent_50%),radial-gradient(ellipse_at_15%_90%,#0a1628_0%,transparent_45%),linear-gradient(180deg,#12151c_0%,#0a0c10_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.35em] text-amber-500/80">
              SESSÃO · IDENTIDADE
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              Escolha o{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Operador
              </span>
            </h1>
            <p className="mt-1 text-sm text-white/40">
              Personagem e skin antes do combate
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
            {(
              [
                { id: "all" as const, label: "Todos" },
                { id: "masc" as const, label: "Masc" },
                { id: "fem" as const, label: "Fem" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                  filter === f.id
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="listbox"
            aria-label="Operadores"
          >
            {filtered.map((op) => {
              const selected = op.id === selectedOp.id;
              const opSkins = listSkinsForOperator(op.id);
              const previewSkin =
                opSkins.find(
                  (s) =>
                    s.id ===
                    (selected ? selectedSkin?.id : op.defaultSkinId),
                ) ?? opSkins[0];
              return (
                <OperatorCard
                  key={op.id}
                  operator={op}
                  gradient={previewSkin?.previewGradient ?? ""}
                  selected={selected}
                  onSelect={() => pickOperator(op)}
                />
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-sm text-white/40">
                Nenhum operador neste filtro.
              </p>
            )}
          </div>

          <Panel
            elevated
            className="flex flex-col p-5 lg:sticky lg:top-8 lg:self-start"
          >
            <div
              className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
              style={{
                background:
                  selectedSkin?.previewGradient ??
                  "linear-gradient(145deg,#333,#111)",
              }}
            >
              <Silhouette gender={selectedOp.gender} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  {selectedOp.gender === "masc" ? "Masc" : "Fem"}
                </p>
                <h2 className="text-2xl font-black text-white">
                  {selectedOp.name}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  {selectedOp.blurb}
                </p>
              </div>
            </div>

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Skin
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              {skins.map((s) => (
                <SkinChip
                  key={s.id}
                  skin={s}
                  selected={s.id === selectedSkin?.id}
                  onSelect={() => setSkinId(s.id)}
                />
              ))}
            </div>

            <Button
              variant="primary"
              onClick={confirm}
              disabled={!ready}
              className="w-full py-3.5 tracking-[0.2em]"
            >
              CONFIRMAR
            </Button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-2 w-full py-2 text-center text-xs text-white/40 transition hover:text-white/70"
            >
              Voltar ao hub
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function OperatorCard({
  operator,
  gradient,
  selected,
  onSelect,
}: {
  operator: OperatorDef;
  gradient: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative min-h-[9rem] overflow-hidden rounded-xl border p-4 text-left transition ${
        selected
          ? "border-amber-400/60 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/30"
          : "border-white/10 hover:border-white/25"
      }`}
      style={{ background: gradient }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end">
        <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {operator.gender === "masc" ? "Masc" : "Fem"}
        </span>
        <span className="text-lg font-black tracking-wide text-white">
          {operator.name}
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/55">
          {operator.blurb}
        </span>
      </div>
      {selected ? (
        <span className="absolute right-3 top-3 z-10 text-[10px] font-bold text-amber-200">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function SkinChip({
  skin,
  selected,
  onSelect,
}: {
  skin: SkinDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
        selected
          ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
          : "border-white/10 bg-black/40 text-white/60 hover:border-white/25 hover:text-white"
      }`}
    >
      <span
        className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-inner"
        style={{
          background: `#${skin.primaryColor.toString(16).padStart(6, "0")}`,
        }}
        aria-hidden
      />
      {skin.name}
      <span className="text-[9px] uppercase tracking-wider text-white/30">
        {skin.rarity}
      </span>
    </button>
  );
}

function Silhouette({ gender }: { gender: GenderPresentation }) {
  return (
    <div
      className="absolute bottom-[18%] left-1/2 h-[62%] w-[42%] -translate-x-1/2 opacity-50"
      aria-hidden
    >
      <div className="absolute bottom-[22%] left-1/2 h-[48%] w-[48%] -translate-x-1/2 rounded-t-[42%] bg-black/70" />
      <div className="absolute bottom-[62%] left-1/2 h-[16%] w-[28%] -translate-x-1/2 rounded-full bg-black/80" />
      {gender === "fem" ? (
        <div className="absolute bottom-[68%] left-1/2 h-[10%] w-[36%] -translate-x-1/2 rounded-full bg-black/50 blur-[1px]" />
      ) : null}
      <div className="absolute bottom-0 left-[22%] h-[26%] w-[18%] rounded-t-md bg-black/75" />
      <div className="absolute bottom-0 right-[22%] h-[26%] w-[18%] rounded-t-md bg-black/75" />
    </div>
  );
}
