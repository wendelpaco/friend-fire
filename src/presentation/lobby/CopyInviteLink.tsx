"use client";

import { useState } from "react";
import { copyInviteLink } from "@/domains/session";

interface CopyInviteLinkProps {
  code: string;
  /** Include host=1 (default false → host=0 for guests). */
  host?: boolean;
  /** compact = HUD chip; default = full-width panel button */
  variant?: "default" | "compact";
  className?: string;
  label?: string;
}

/**
 * Copies `${origin}/play?mode=room&code=XXXX&host=0|1` to the clipboard.
 */
export function CopyInviteLink({
  code,
  host = false,
  variant = "default",
  className = "",
  label = "Copiar link do convite",
}: CopyInviteLinkProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyInviteLink(code, { host });
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => void onCopy()}
        title="Copiar link do convite"
        className={`pointer-events-auto rounded-md border border-amber-400/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-100/95 shadow backdrop-blur-md transition hover:bg-amber-500/20 ${className}`}
      >
        {copied ? "Link copiado!" : "Copiar link"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={`rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 ${className}`}
    >
      {copied ? "Link copiado!" : label}
    </button>
  );
}
