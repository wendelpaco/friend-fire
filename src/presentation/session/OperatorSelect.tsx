"use client";

import { useMemo, useState } from "react";
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

function readInitialPrefs(): { operatorId: OperatorId; skinId: string } {
  // Lazy init only — never call during render body (avoids unstable snapshots).
  if (typeof window === "undefined") {
    return { operatorId: "brick", skinId: "brick-default" };
  }
  try {
    const p = getOperatorPrefs();
    return { operatorId: p.operatorId, skinId: p.skinId };
  } catch {
    return { operatorId: "brick", skinId: "brick-default" };
  }
}

/**
 * Character + skin select (Meta-1 Path B).
 * Confirm → setOperatorPrefs + router.push(next).
 */
export function OperatorSelect({ next }: OperatorSelectProps) {
  const router = useRouter();
  const operators = listOperators();

  const [filter, setFilter] = useState<GenderFilter>("all");
  const [operatorId, setOperatorId] = useState<OperatorId>(
    () => readInitialPrefs().operatorId,
  );
  const [skinId, setSkinId] = useState(() => readInitialPrefs().skinId);

  const filtered = useMemo(() => {
    if (filter === "all") return operators;
    return operators.filter((o) => o.gender === filter);
  }, [operators, filter]);

  const selectedOp: OperatorDef =
    getOperatorById(operatorId) ?? operators[0]!;
  const skins = listSkinsForOperator(selectedOp.id);
  const skinCandidate = getSkinById(skinId);
  const selectedSkin: SkinDef =
    skinCandidate && skinCandidate.operatorId === selectedOp.id
      ? skinCandidate
      : skins[0]!;

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
      skinId: selectedSkin.id,
    });
    router.push(resolveOperatorNext(next));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--ff-void)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#3b1a08_0%,transparent_50%),radial-gradient(ellipse_at_15%_90%,#0a1628_0%,transparent_45%),linear-gradient(180deg,#12151c_0%,#0a0c10_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 motion-safe:animate-ff-fade-in sm:px-6 lg:px-10">
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
                    (selected ? selectedSkin.id : op.defaultSkinId),
                ) ?? opSkins[0];
              return (
                <OperatorCard
                  key={op.id}
                  operator={op}
                  selected={selected}
                  previewGradient={previewSkin?.previewGradient ?? ""}
                  onSelect={() => pickOperator(op)}
                />
              );
            })}
          </div>

          <aside className="flex flex-col gap-4">
            <Panel elevated className="overflow-hidden p-0">
              <div
                className="h-40 w-full"
                style={{
                  background:
                    selectedSkin.previewGradient ||
                    "linear-gradient(135deg,#333,#111)",
                }}
              />
              <div className="space-y-2 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
                  {selectedOp.gender === "masc" ? "Masc" : "Fem"}
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  {selectedOp.name}
                </h2>
                <p className="text-sm leading-relaxed text-white/50">
                  {selectedOp.blurb}
                </p>
              </div>
            </Panel>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Skin
              </div>
              <div className="flex flex-wrap gap-2">
                {skins.map((s) => {
                  const on = s.id === selectedSkin.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSkinId(s.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold motion-safe:transition-all motion-safe:duration-150 ${
                        on
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:scale-[1.02]"
                      }`}
                    >
                      <span
                        className="mb-1 block h-2 w-10 rounded-full"
                        style={{ background: s.previewGradient }}
                      />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="button" className="w-full" onClick={confirm}>
              Confirmar
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OperatorCard({
  operator,
  selected,
  previewGradient,
  onSelect,
}: {
  operator: OperatorDef;
  selected: boolean;
  previewGradient: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex overflow-hidden rounded-xl border text-left motion-safe:transition-all motion-safe:duration-150 ${
        selected
          ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:scale-[1.01]"
      }`}
    >
      <div
        className="w-2 shrink-0 self-stretch"
        style={{ background: previewGradient }}
      />
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-black tracking-tight">
            {operator.name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            {operator.gender === "masc" ? "Masc" : "Fem"}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-white/45">
          {operator.blurb}
        </p>
      </div>
    </button>
  );
}
