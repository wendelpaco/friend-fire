import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
};

/** FF Tactical surface — dark panel with amber-border hierarchy. */
export function Panel({ children, className = "", elevated = false }: PanelProps) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--ff-border)] backdrop-blur-md ${
        elevated
          ? "bg-[color:var(--ff-panel-2)]/95"
          : "bg-[color:var(--ff-panel)]/90"
      } ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  title?: string;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-amber-400/50 bg-gradient-to-r from-amber-600 to-amber-500 text-black font-black shadow-lg shadow-amber-900/35 motion-safe:transition-all motion-safe:duration-150 hover:from-amber-500 hover:to-amber-400 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100",
  ghost:
    "border-white/10 bg-black/45 text-white/80 font-semibold motion-safe:transition-all motion-safe:duration-150 hover:border-white/20 hover:bg-black/60 hover:text-white active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100",
  danger:
    "border-red-500/40 bg-red-950/50 text-red-200 font-semibold motion-safe:transition-all motion-safe:duration-150 hover:bg-red-900/50 active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100",
};

/** FF Tactical button — primary / ghost / danger. */
export function Button({
  children,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  onClick,
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`rounded-xl border px-5 py-3 text-center text-sm tracking-wide transition disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
