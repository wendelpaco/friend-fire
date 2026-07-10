"use client";

import { useState } from "react";
import { copyInviteLink } from "@/domains/session";

interface CopyInviteLinkProps {
  code: string;
  /** Include host=1 (default false → host=0 for guests). */
  host?: boolean;
  /** Include ?map= so guests boot the same arena. */
  mapId?: string;
  /** compact = HUD chip; default = full-width panel button */
  variant?: "default" | "compact";
  className?: string;
  label?: string;
}

/**
 * Copies `${origin}/play?mode=room&code=XXXX&host=0|1&map=…` to the clipboard.
 */
export function CopyInviteLink({
  code,
  host = false,
  mapId,
  variant = "default",
  className = "",
  label = "COPIAR CONVITE",
}: CopyInviteLinkProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyInviteLink(code, { host, mapId });
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => void onCopy()}
        title="Copiar link do convite (deep link)"
        className={`pointer-events-auto rounded-md border border-amber-400/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-100/95 shadow backdrop-blur-md transition hover:bg-amber-500/20 ${className}`}
      >
        {copied ? "Copiado!" : "COPIAR CONVITE"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="Copia deep link completo da sala"
      className={`rounded-xl border border-amber-400/25 bg-amber-500/10 py-3 text-sm font-semibold tracking-wide text-amber-100/90 transition hover:border-amber-400/40 hover:bg-amber-500/15 ${className}`}
    >
      {copied ? "Convite copiado!" : label}
    </button>
  );
}
